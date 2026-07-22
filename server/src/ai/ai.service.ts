import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promisify } from 'util';
import {
  DocumentAuditAction,
  DocumentCategory,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { StoredFileService } from '../media/stored-file.service';
import {
  AI_PROVIDER,
  AIProvider,
  AiAnalysisResult,
} from './interfaces/ai-provider.interface';

/** The AI view of a document, assembled for the client. */
export interface DocumentAiResponse {
  documentId: string;
  status: 'NONE' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  analyzedByAI: boolean;
  effectiveCategory: DocumentCategory;
  summary: string | null;
  classification: {
    predictedCategory: DocumentCategory;
    confidence: number;
    approvedCategory: DocumentCategory | null;
    approvedAt: Date | null;
  } | null;
  fields: {
    key: string;
    valueText: string | null;
    valueNumber: number | null;
    valueDate: Date | null;
    confidence: number | null;
  }[];
  latestJob: {
    id: string;
    status: string;
    attempts: number;
    errorMessage: string | null;
    completedAt: Date | null;
  } | null;
}

// File types Claude can read directly as multimodal input (images + PDF).
const ANALYZABLE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);
// Office formats the model can't read directly — converted to PDF (LibreOffice)
// before sending, so docx/doc/xls/xlsx are analyzed with full fidelity.
const CONVERTIBLE_MIME = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
// Plain-text formats — sent as extracted text rather than an image/PDF.
const TEXT_MIME = new Set(['text/plain', 'text/csv']);

// Keep the base64 payload comfortably within Bedrock's request-size limits
// (base64 inflates ~33%). Larger files/results fall back to filename-only.
const MAX_ANALYSIS_BYTES = 4.5 * 1024 * 1024;
// A source doc can be modest but produce a big PDF; cap the input we convert.
const MAX_CONVERT_SOURCE_BYTES = 15 * 1024 * 1024;
// Cap extracted text so the prompt stays reasonable.
const MAX_TEXT_CHARS = 100_000;

/** Content prepared for the model: image/PDF bytes, or extracted text. */
interface AnalysisContent {
  base64?: string;
  mimeType?: string;
  text?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly propertiesService: PropertiesService,
    private readonly storedFileService: StoredFileService,
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
  ) {}

  private get enabled(): boolean {
    return this.config.get<string>('AI_ENABLED', 'false') === 'true';
  }

  /**
   * Map an `Accept-Language` header (e.g. "he-IL", "en-US,en;q=0.9") to the
   * output language the AI summary should be written in. Defaults to English.
   */
  private static resolveLanguage(acceptLanguage?: string | null): string {
    const primary = (acceptLanguage || '').trim().slice(0, 2).toLowerCase();
    return primary === 'he' ? 'Hebrew' : 'English';
  }

  private logAudit(
    action: DocumentAuditAction,
    params: {
      documentId?: string | null;
      propertyId?: string | null;
      actorId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): void {
    this.prisma.documentAuditLog
      .create({
        data: {
          action,
          documentId: params.documentId ?? null,
          propertyId: params.propertyId ?? null,
          actorId: params.actorId ?? null,
          metadata: params.metadata as Prisma.InputJsonValue | undefined,
        },
      })
      .catch((err) =>
        this.logger.error(
          `Failed to write ${action} audit log`,
          err instanceof Error ? err.stack : String(err),
        ),
      );
  }

  // ============================================
  // Access helpers
  // ============================================

  private async loadAccess(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        category: true,
        storedFileId: true,
        propertyId: true,
        leaseId: true,
        lease: { select: { propertyId: true, tenantId: true, property: { select: { ownerId: true } } } },
        property: { select: { ownerId: true } },
      },
    });
    if (!document) throw new NotFoundException('Document not found');

    const propertyId = document.propertyId ?? document.lease?.propertyId ?? null;
    const ownerId =
      document.property?.ownerId ?? document.lease?.property.ownerId ?? null;
    const tenantId = document.lease?.tenantId ?? null;
    return { document, propertyId, ownerId, tenantId };
  }

  private async assertAccess(documentId: string, userId: string) {
    const ctx = await this.loadAccess(documentId);
    const isOwner = ctx.ownerId === userId;
    let hasAccess = isOwner || ctx.tenantId === userId;
    // Property documents: fall back to the shared property-access rule.
    if (!hasAccess && ctx.document.propertyId) {
      hasAccess = await this.propertiesService.userHasAccess(
        ctx.document.propertyId,
        userId,
      );
    }
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this document');
    }
    return ctx;
  }

  private async assertOwner(documentId: string, userId: string) {
    const ctx = await this.loadAccess(documentId);
    if (ctx.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the property owner can manage AI for this document',
      );
    }
    return ctx;
  }

  // ============================================
  // Queue
  // ============================================

  /**
   * Enqueue AI analysis for a document. Fire-and-forget and flag-gated — this
   * NEVER blocks the upload request. Processing runs on the next tick via
   * setImmediate; a future SQS worker would replace that trigger and call the
   * same processJob().
   */
  async enqueue(
    documentId: string,
    actorId?: string,
    acceptLanguage?: string | null,
  ): Promise<void> {
    if (!this.enabled) return;
    const outputLanguage = AiService.resolveLanguage(acceptLanguage);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        storedFileId: true,
        propertyId: true,
        lease: { select: { propertyId: true } },
      },
    });
    // Nothing to analyze without an actual file (e.g. a REQUESTED document).
    if (!document || !document.storedFileId) return;

    const propertyId = document.propertyId ?? document.lease?.propertyId ?? null;

    const job = await this.prisma.aiJob.create({
      data: {
        documentId,
        provider: this.provider.name,
        model: this.provider.model,
        status: 'QUEUED',
      },
    });

    this.logAudit(DocumentAuditAction.AI_REQUESTED, {
      documentId,
      propertyId,
      actorId: actorId ?? null,
      metadata: { jobId: job.id, provider: this.provider.name },
    });

    setImmediate(() => {
      this.processJob(job.id, outputLanguage).catch((err) =>
        this.logger.error(
          `AI job ${job.id} crashed`,
          err instanceof Error ? err.stack : String(err),
        ),
      );
    });
  }

  /**
   * Process a single job: QUEUED → PROCESSING → COMPLETED/FAILED. Public and
   * idempotent so a future background worker can invoke it directly.
   */
  async processJob(jobId: string, outputLanguage = 'English'): Promise<void> {
    const job = await this.prisma.aiJob.findUnique({
      where: { id: jobId },
      include: { document: { include: { storedFile: true } } },
    });
    if (!job) return;

    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
    });

    const doc = job.document;
    const propertyId = doc.propertyId ?? null;

    try {
      const fileUrl = doc.storedFile
        ? this.storedFileService.getPublicUrl(doc.storedFile)
        : null;
      const content = await this.prepareContent(doc.storedFile);

      const result = await this.provider.analyzeDocument({
        documentId: doc.id,
        fileName: doc.storedFile?.originalFilename ?? doc.name,
        // Effective media type of the content we're actually sending (e.g. a
        // converted docx is now application/pdf).
        mimeType: content?.mimeType ?? doc.storedFile?.mimeType ?? null,
        fileUrl,
        fileBase64: content?.base64 ?? null,
        text: content?.text ?? null,
        outputLanguage,
      });

      await this.persistResult(doc.id, result);

      await this.prisma.aiJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date(), errorMessage: null },
      });
      this.logAudit(DocumentAuditAction.AI_COMPLETED, {
        documentId: doc.id,
        propertyId,
        metadata: { jobId, provider: job.provider },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.aiJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: message },
      });
      this.logAudit(DocumentAuditAction.AI_FAILED, {
        documentId: doc.id,
        propertyId,
        metadata: { jobId, error: message },
      });
    }
  }

  /**
   * Prepare a document for the model. Images/PDFs are sent as-is; Office files
   * (docx/doc/xls/xlsx) are converted to PDF via LibreOffice; text/csv are sent
   * as extracted text. Returns null for unsupported/oversized files (the
   * provider then falls back to filename-only). Reuses the shared storage
   * pipeline — no download logic is duplicated.
   */
  private async prepareContent(
    storedFile: { storageKey: string; mimeType: string; fileSize: number } | null,
  ): Promise<AnalysisContent | null> {
    if (!storedFile) return null;
    const { mimeType, fileSize } = storedFile;

    const directlyReadable = ANALYZABLE_MIME.has(mimeType);
    const convertible = CONVERTIBLE_MIME.has(mimeType);
    const isText = TEXT_MIME.has(mimeType);
    if (!directlyReadable && !convertible && !isText) return null;

    const sizeCap = convertible ? MAX_CONVERT_SOURCE_BYTES : MAX_ANALYSIS_BYTES;
    if (fileSize > sizeCap) return null;

    try {
      const buffer = await this.storedFileService.getBuffer(storedFile);

      if (isText) {
        return { text: buffer.toString('utf8').slice(0, MAX_TEXT_CHARS) };
      }

      if (convertible) {
        const pdf = await this.convertToPdf(buffer);
        if (pdf.length > MAX_ANALYSIS_BYTES) return null; // too big to send
        return { base64: pdf.toString('base64'), mimeType: 'application/pdf' };
      }

      // Image or PDF, sent as-is.
      return { base64: buffer.toString('base64'), mimeType };
    } catch (err) {
      this.logger.warn(
        `Could not prepare content for AI analysis of ${storedFile.storageKey}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /**
   * Convert an Office document to PDF with headless LibreOffice (bundled in the
   * image). Lazy-required so nothing loads it unless a conversion is needed.
   */
  private async convertToPdf(input: Buffer): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const libre = require('libreoffice-convert');
    const convert: (
      buf: Buffer,
      ext: string,
      filter: undefined,
    ) => Promise<Buffer> = promisify(libre.convert);
    return convert(input, '.pdf', undefined);
  }

  /**
   * Persist provider output. Summary + extracted fields are replaced wholesale;
   * the classification's PREDICTED fields are (over)written but the user-owned
   * APPROVED fields are NEVER touched — the user's decision always wins.
   */
  private async persistResult(
    documentId: string,
    result: AiAnalysisResult,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.aiSummary.upsert({
        where: { documentId },
        create: {
          documentId,
          text: result.summary,
          provider: result.provider,
          model: result.model,
        },
        update: {
          text: result.summary,
          provider: result.provider,
          model: result.model,
        },
      });

      await tx.aiClassification.upsert({
        where: { documentId },
        create: {
          documentId,
          predictedCategory: result.classification.category,
          confidence: result.classification.confidence,
          provider: result.provider,
          model: result.model,
        },
        // Update ONLY prediction fields — approvedCategory/approvedById/
        // approvedAt are intentionally omitted so a user decision survives.
        update: {
          predictedCategory: result.classification.category,
          confidence: result.classification.confidence,
          provider: result.provider,
          model: result.model,
        },
      });

      await tx.aiExtractedField.deleteMany({ where: { documentId } });
      if (result.fields.length > 0) {
        await tx.aiExtractedField.createMany({
          data: result.fields.map((f) => ({
            documentId,
            key: f.key,
            valueText: f.valueText ?? null,
            valueNumber:
              f.valueNumber !== undefined && f.valueNumber !== null
                ? new Prisma.Decimal(f.valueNumber)
                : null,
            valueDate: f.valueDate ? new Date(f.valueDate) : null,
            confidence: f.confidence ?? null,
          })),
        });
      }
    });
  }

  // ============================================
  // Reads / actions
  // ============================================

  async getForDocument(
    documentId: string,
    userId: string,
  ): Promise<DocumentAiResponse> {
    const ctx = await this.assertAccess(documentId, userId);

    const [latestJob, summary, classification, fields] = await Promise.all([
      this.prisma.aiJob.findFirst({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aiSummary.findUnique({ where: { documentId } }),
      this.prisma.aiClassification.findUnique({ where: { documentId } }),
      this.prisma.aiExtractedField.findMany({
        where: { documentId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      documentId,
      status: latestJob?.status ?? 'NONE',
      analyzedByAI: latestJob?.status === 'COMPLETED',
      effectiveCategory: ctx.document.category,
      summary: summary?.text ?? null,
      classification: classification
        ? {
            predictedCategory: classification.predictedCategory,
            confidence: classification.confidence,
            approvedCategory: classification.approvedCategory,
            approvedAt: classification.approvedAt,
          }
        : null,
      fields: fields.map((f) => ({
        key: f.key,
        valueText: f.valueText,
        valueNumber: f.valueNumber ? f.valueNumber.toNumber() : null,
        valueDate: f.valueDate,
        confidence: f.confidence,
      })),
      latestJob: latestJob
        ? {
            id: latestJob.id,
            status: latestJob.status,
            attempts: latestJob.attempts,
            errorMessage: latestJob.errorMessage,
            completedAt: latestJob.completedAt,
          }
        : null,
    };
  }

  /** Manual retry — enqueue a fresh job. No scheduling. Owner only. */
  async retry(
    documentId: string,
    userId: string,
    acceptLanguage?: string | null,
  ): Promise<void> {
    const ctx = await this.assertOwner(documentId, userId);
    this.logAudit(DocumentAuditAction.AI_RETRIED, {
      documentId,
      propertyId: ctx.propertyId,
      actorId: userId,
    });
    await this.enqueue(documentId, userId, acceptLanguage);
  }

  /**
   * Record the user's category decision. Sets the OFFICIAL Document.category and
   * stamps the approval on the classification (prediction retained). The AI
   * pipeline never overwrites these fields.
   */
  async setCategory(
    documentId: string,
    category: DocumentCategory,
    userId: string,
  ): Promise<DocumentAiResponse> {
    const ctx = await this.assertOwner(documentId, userId);

    const existing = await this.prisma.aiClassification.findUnique({
      where: { documentId },
      select: { predictedCategory: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: { category },
      });
      if (existing) {
        await tx.aiClassification.update({
          where: { documentId },
          data: {
            approvedCategory: category,
            approvedById: userId,
            approvedAt: new Date(),
          },
        });
      }
    });

    const accepted = existing?.predictedCategory === category;
    this.logAudit(
      accepted
        ? DocumentAuditAction.AI_SUGGESTION_ACCEPTED
        : DocumentAuditAction.AI_CATEGORY_CHANGED,
      {
        documentId,
        propertyId: ctx.propertyId,
        actorId: userId,
        metadata: { category, predicted: existing?.predictedCategory ?? null },
      },
    );

    return this.getForDocument(documentId, userId);
  }
}

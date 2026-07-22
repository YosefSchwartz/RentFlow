import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
// archiver v8 exports format-specific classes instead of the old callable factory.
import { ZipArchive } from 'archiver';
import {
  DocumentCategory,
  DocumentPermission,
  DocumentAuditAction,
  ReceiptSource,
  SystemFolderKey,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { StoredFileService } from '../media/stored-file.service';
import { AiService } from '../ai/ai.service';
import { UploadReceiptDto } from './dto/upload-receipt.dto';

/** Business-facing receipt (metadata + the underlying document's file facts). */
export interface ReceiptResponse {
  id: string;
  documentId: string;
  propertyId: string | null;
  name: string;
  receiptDate: Date | null;
  taxYear: number;
  source: ReceiptSource;
  relatedMaintenanceId: string | null;
  relatedLeaseId: string | null;
  notes: string | null;
  createdAt: Date;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
}

export interface ReceiptYearSummary {
  taxYear: number;
  count: number;
  totalStorageBytes: number;
}

/** Parameters shared by every receipt-creation path. */
export interface RegisterReceiptParams {
  source: ReceiptSource;
  actorId: string;
  receiptDate?: Date | null;
  relatedMaintenanceId?: string | null;
  relatedLeaseId?: string | null;
  notes?: string | null;
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly propertiesService: PropertiesService,
    private readonly storedFileService: StoredFileService,
    private readonly aiService: AiService,
  ) {}

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
          metadata: params.metadata as any,
        },
      })
      .catch((err) =>
        this.logger.error(
          `Failed to write ${action} audit log`,
          err instanceof Error ? err.stack : String(err),
        ),
      );
  }

  private async ensureOwner(propertyId: string, userId: string): Promise<void> {
    const isOwner = await this.propertiesService.isOwner(propertyId, userId);
    if (!isOwner) {
      throw new ForbiddenException('Only the property owner can manage receipts');
    }
  }

  /**
   * Find (or create) the `Receipts → <taxYear>` folder for a property. The
   * per-year folder is a system folder (undeletable) with no systemKey, so the
   * client displays its literal name (the year).
   */
  private async ensureTaxYearFolder(
    propertyId: string,
    taxYear: number,
    actorId: string,
  ): Promise<string> {
    let receiptsFolder = await this.prisma.folder.findFirst({
      where: { propertyId, systemKey: SystemFolderKey.RECEIPTS },
      select: { id: true },
    });

    // Defensive: a property created before PR1's backfill may lack the folder.
    if (!receiptsFolder) {
      receiptsFolder = await this.prisma.folder.create({
        data: {
          name: 'Receipts',
          systemKey: SystemFolderKey.RECEIPTS,
          isSystem: true,
          propertyId,
          createdById: actorId,
        },
        select: { id: true },
      });
    }

    const yearName = String(taxYear);
    const existing = await this.prisma.folder.findFirst({
      where: { propertyId, parentId: receiptsFolder.id, name: yearName },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.folder.create({
      data: {
        name: yearName,
        isSystem: true,
        propertyId,
        parentId: receiptsFolder.id,
        createdById: actorId,
      },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Shared core: derive the tax year, file the document under Receipts/<year>,
   * and create the Receipt metadata row. Called by the manual upload path and
   * by the maintenance-receipt path in DocumentsService.
   */
  async registerReceipt(
    document: { id: string; propertyId: string | null; createdAt: Date },
    params: RegisterReceiptParams,
  ): Promise<void> {
    if (!document.propertyId) {
      throw new BadRequestException('A receipt must belong to a property');
    }

    const basisDate = params.receiptDate ?? document.createdAt;
    const taxYear = basisDate.getFullYear();

    const folderId = await this.ensureTaxYearFolder(
      document.propertyId,
      taxYear,
      params.actorId,
    );

    await this.prisma.$transaction([
      this.prisma.document.update({
        where: { id: document.id },
        data: { folderId },
      }),
      this.prisma.receipt.create({
        data: {
          documentId: document.id,
          receiptDate: params.receiptDate ?? null,
          taxYear,
          source: params.source,
          relatedMaintenanceId: params.relatedMaintenanceId ?? null,
          relatedLeaseId: params.relatedLeaseId ?? null,
          notes: params.notes ?? null,
        },
      }),
    ]);
  }

  /** Manual receipt upload (landlord). Reuses the shared StoredFile pipeline. */
  async uploadManual(
    propertyId: string,
    file: Express.Multer.File,
    dto: UploadReceiptDto,
    userId: string,
  ): Promise<ReceiptResponse> {
    await this.ensureOwner(propertyId, userId);

    const storedFile = await this.storedFileService.upload({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      keyParts: ['properties', propertyId, 'receipts'],
      uploadedById: userId,
    });

    const document = await this.prisma.document.create({
      data: {
        name: dto.name?.trim() || file.originalname,
        category: DocumentCategory.RECEIPT,
        // Receipts are financial/tax documents — private to the landlord by
        // default (distinct from maintenance receipts, which are shared).
        permission: DocumentPermission.LANDLORD_ONLY,
        propertyId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
    });

    await this.registerReceipt(document, {
      source: ReceiptSource.MANUAL_UPLOAD,
      actorId: userId,
      receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : null,
      relatedLeaseId: dto.relatedLeaseId ?? null,
      notes: dto.notes ?? null,
    });

    this.logAudit(DocumentAuditAction.UPLOAD, {
      documentId: document.id,
      propertyId,
      actorId: userId,
      metadata: { name: document.name, category: DocumentCategory.RECEIPT },
    });

    // Background AI analysis (never blocks the upload).
    await this.aiService
      .enqueue(document.id, userId)
      .catch(() => undefined);

    const receipt = await this.prisma.receipt.findUniqueOrThrow({
      where: { documentId: document.id },
      include: { document: { include: { storedFile: true } } },
    });
    return this.toDto(receipt);
  }

  private toDto(receipt: {
    id: string;
    receiptDate: Date | null;
    taxYear: number;
    source: ReceiptSource;
    relatedMaintenanceId: string | null;
    relatedLeaseId: string | null;
    notes: string | null;
    createdAt: Date;
    document: {
      id: string;
      name: string;
      propertyId: string | null;
      storedFile: { fileSize: number; mimeType: string; storageKey: string } | null;
    };
  }): ReceiptResponse {
    const sf = receipt.document.storedFile;
    return {
      id: receipt.id,
      documentId: receipt.document.id,
      propertyId: receipt.document.propertyId,
      name: receipt.document.name,
      receiptDate: receipt.receiptDate,
      taxYear: receipt.taxYear,
      source: receipt.source,
      relatedMaintenanceId: receipt.relatedMaintenanceId,
      relatedLeaseId: receipt.relatedLeaseId,
      notes: receipt.notes,
      createdAt: receipt.createdAt,
      fileUrl: sf ? this.storedFileService.getPublicUrl(sf) : null,
      fileSize: sf ? sf.fileSize : null,
      mimeType: sf ? sf.mimeType : null,
    };
  }

  async listForProperty(
    propertyId: string,
    userId: string,
    year?: number,
  ): Promise<ReceiptResponse[]> {
    await this.ensureOwner(propertyId, userId);

    const receipts = await this.prisma.receipt.findMany({
      where: {
        document: { propertyId },
        ...(year ? { taxYear: year } : {}),
      },
      include: { document: { include: { storedFile: true } } },
      orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
    });

    return receipts.map((r) => this.toDto(r));
  }

  /** Per-tax-year rollup: count + total storage. No accounting math. */
  async summary(
    propertyId: string,
    userId: string,
  ): Promise<ReceiptYearSummary[]> {
    await this.ensureOwner(propertyId, userId);

    const receipts = await this.prisma.receipt.findMany({
      where: { document: { propertyId } },
      select: {
        taxYear: true,
        document: { select: { storedFile: { select: { fileSize: true } } } },
      },
    });

    const byYear = new Map<number, ReceiptYearSummary>();
    for (const r of receipts) {
      const entry =
        byYear.get(r.taxYear) ??
        { taxYear: r.taxYear, count: 0, totalStorageBytes: 0 };
      entry.count += 1;
      entry.totalStorageBytes += r.document.storedFile?.fileSize ?? 0;
      byYear.set(r.taxYear, entry);
    }

    return Array.from(byYear.values()).sort((a, b) => b.taxYear - a.taxYear);
  }

  // ============================================
  // Exports (infrastructure)
  // ============================================

  async exportCsv(
    propertyId: string,
    userId: string,
    year?: number,
  ): Promise<string> {
    const receipts = await this.listForProperty(propertyId, userId, year);

    const header = [
      'name',
      'receiptDate',
      'taxYear',
      'source',
      'relatedMaintenanceId',
      'relatedLeaseId',
      'fileSize',
      'mimeType',
      'notes',
      'createdAt',
    ];

    const escape = (value: unknown): string => {
      const s = value === null || value === undefined ? '' : String(value);
      // RFC-4180 quoting for values containing quotes, commas or newlines.
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = receipts.map((r) =>
      [
        r.name,
        r.receiptDate ? r.receiptDate.toISOString().slice(0, 10) : '',
        r.taxYear,
        r.source,
        r.relatedMaintenanceId ?? '',
        r.relatedLeaseId ?? '',
        r.fileSize ?? '',
        r.mimeType ?? '',
        r.notes ?? '',
        r.createdAt.toISOString(),
      ]
        .map(escape)
        .join(','),
    );

    return [header.join(','), ...rows].join('\n');
  }

  /** Stream a ZIP of the receipt files, foldered by tax year. */
  async exportZip(
    propertyId: string,
    userId: string,
    year: number | undefined,
    res: Response,
  ): Promise<void> {
    await this.ensureOwner(propertyId, userId);

    const receipts = await this.prisma.receipt.findMany({
      where: {
        document: { propertyId },
        ...(year ? { taxYear: year } : {}),
      },
      include: { document: { include: { storedFile: true } } },
      orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
    });

    const filename = year ? `receipts-${year}.zip` : 'receipts.zip';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (err: Error) => {
      this.logger.error('ZIP export failed', err.stack);
      res.destroy(err);
    });
    archive.pipe(res);

    for (const r of receipts) {
      const sf = r.document.storedFile;
      if (!sf) continue;
      const buffer = await this.storedFileService.getBuffer(sf);
      // Prefix with the receipt id to guarantee unique entry names within a year.
      const safeName = r.document.name.replace(/[/\\]/g, '_');
      archive.append(buffer, { name: `${r.taxYear}/${r.id}-${safeName}` });
    }

    await archive.finalize();
  }
}

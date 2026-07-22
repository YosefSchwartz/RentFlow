import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  Document,
  DocumentCategory,
  DocumentStatus,
  DocumentPermission,
  DocumentAuditAction,
  MaintenanceStatus,
  Prisma,
  ReceiptSource,
  StoredFile,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { StoredFileService } from '../media/stored-file.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReceiptsService } from '../receipts/receipts.service';
import { AiService } from '../ai/ai.service';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { GetUploadUrlDto } from './dto/upload-document.dto';
import { RequestDocumentDto } from './dto/request-document.dto';
import { BulkDeleteDocumentsDto } from './dto/bulk-delete-documents.dto';
import { BulkMoveDocumentsDto } from './dto/bulk-move-documents.dto';

// Reusable select for a user shown alongside a document.
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

/**
 * Business-facing document response. Storage facts (url/size/mimeType) are
 * assembled from the linked StoredFile; storageKey/bucket are never exposed.
 */
export interface DocumentResponse {
  id: string;
  propertyId: string | null;
  leaseId: string | null;
  folderId: string | null;
  name: string;
  category: DocumentCategory;
  permission: DocumentPermission;
  status: DocumentStatus;
  requestedAt: Date | null;
  receivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  lease?: unknown;
  uploadedBy?: unknown;
}

type DocumentWithFile = Document & {
  storedFile?: StoredFile | null;
  lease?: unknown;
  uploadedBy?: unknown;
};

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly propertiesService: PropertiesService,
    private readonly storedFileService: StoredFileService,
    private readonly notifications: NotificationsService,
    private readonly receiptsService: ReceiptsService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Kick off background AI analysis for a freshly-uploaded document. Awaited
   * only for the quick job-row creation (the provider call runs after the
   * response); errors are swallowed so AI never affects the upload.
   */
  private async enqueueAi(documentId: string, userId: string): Promise<void> {
    await this.aiService
      .enqueue(documentId, userId)
      .catch((err) =>
        this.logger.warn(
          `AI enqueue failed for ${documentId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
  }

  /** Assemble the public DTO from a document and its (optional) StoredFile. */
  private toDto(doc: DocumentWithFile): DocumentResponse {
    const sf = doc.storedFile ?? null;
    const dto: DocumentResponse = {
      id: doc.id,
      propertyId: doc.propertyId,
      leaseId: doc.leaseId,
      folderId: doc.folderId,
      name: doc.name,
      category: doc.category,
      permission: doc.permission,
      status: doc.status,
      requestedAt: doc.requestedAt,
      receivedAt: doc.receivedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      fileUrl: sf ? this.storedFileService.getPublicUrl(sf) : null,
      fileSize: sf ? sf.fileSize : null,
      mimeType: sf ? sf.mimeType : null,
    };
    if (doc.lease !== undefined) dto.lease = doc.lease;
    if (doc.uploadedBy !== undefined) dto.uploadedBy = doc.uploadedBy;
    return dto;
  }

  // ============================================
  // Audit log
  // ============================================

  /**
   * Append an audit-log row. Fire-and-forget: audit failures are logged but
   * never block or fail the originating request. Extend by adding a
   * DocumentAuditAction value and calling this from the relevant path.
   */
  private logAudit(
    action: DocumentAuditAction,
    params: {
      documentId?: string | null;
      propertyId?: string | null;
      actorId?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ): void {
    this.prisma.documentAuditLog
      .create({
        data: {
          action,
          documentId: params.documentId ?? null,
          propertyId: params.propertyId ?? null,
          actorId: params.actorId ?? null,
          metadata: params.metadata,
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
  // Reads
  // ============================================

  async findAllForProperty(
    propertyId: string,
    userId: string,
  ): Promise<DocumentResponse[]> {
    const hasAccess = await this.propertiesService.userHasAccess(
      propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this property');
    }

    // Owners see everything; tenants only see documents shared with them.
    const isOwner = await this.propertiesService.isOwner(propertyId, userId);

    const documents = await this.prisma.document.findMany({
      where: {
        propertyId,
        ...(isOwner
          ? {}
          : { permission: DocumentPermission.LANDLORD_AND_TENANT }),
      },
      include: { storedFile: true },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((d) => this.toDto(d));
  }

  async findOne(id: string, userId: string): Promise<DocumentResponse> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        storedFile: true,
        property: true,
        lease: true,
        uploadedBy: { select: USER_SELECT },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const hasAccess = await this.checkDocumentAccess(document, userId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this document');
    }

    return this.toDto(document);
  }

  async findAllForLease(
    leaseId: string,
    userId: string,
  ): Promise<DocumentResponse[]> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { property: { select: { ownerId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    const isOwner = lease.property.ownerId === userId;
    const hasAccess = isOwner || lease.tenantId === userId;
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this lease');
    }

    const documents = await this.prisma.document.findMany({
      where: {
        leaseId,
        // Owners see everything; tenants only see shared documents (required
        // documents are created shared, so they remain visible to the tenant).
        ...(isOwner
          ? {}
          : { permission: DocumentPermission.LANDLORD_AND_TENANT }),
      },
      include: {
        storedFile: true,
        uploadedBy: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((d) => this.toDto(d));
  }

  /**
   * List required documents (REQUESTED/RECEIVED) across a property's leases.
   * Owner-only — used by the landlord to track request status.
   */
  async findRequiredForProperty(
    propertyId: string,
    userId: string,
  ): Promise<DocumentResponse[]> {
    const isOwner = await this.propertiesService.isOwner(propertyId, userId);
    if (!isOwner) {
      throw new ForbiddenException(
        'Only the property owner can view required documents',
      );
    }

    const documents = await this.prisma.document.findMany({
      where: {
        lease: { propertyId },
        status: { in: [DocumentStatus.REQUESTED, DocumentStatus.RECEIVED] },
      },
      include: {
        storedFile: true,
        lease: { include: { tenant: { select: USER_SELECT } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((d) => this.toDto(d));
  }

  // ============================================
  // Access helpers
  // ============================================

  private async checkDocumentAccess(
    document: { propertyId?: string | null; leaseId?: string | null },
    userId: string,
  ): Promise<boolean> {
    if (document.propertyId) {
      return this.propertiesService.userHasAccess(document.propertyId, userId);
    }
    if (document.leaseId) {
      return this.hasLeaseAccess(document.leaseId, userId);
    }
    return false;
  }

  private async hasLeaseAccess(
    leaseId: string,
    userId: string,
  ): Promise<boolean> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { property: { select: { ownerId: true } } },
    });
    if (!lease) return false;
    return lease.property.ownerId === userId || lease.tenantId === userId;
  }

  private async canModifyDocument(
    document: {
      propertyId?: string | null;
      leaseId?: string | null;
      lease?: any;
    },
    userId: string,
  ): Promise<boolean> {
    if (document.propertyId) {
      return this.propertiesService.isOwner(document.propertyId, userId);
    }
    if (document.leaseId && document.lease) {
      return document.lease.property.ownerId === userId;
    }
    return false;
  }

  /**
   * Validate a folder exists and belongs to the given property. Folders are a
   * property-level concept; lease documents are filed under their property's
   * folders. Passing null/undefined clears the folder (root).
   */
  private async assertFolderInProperty(
    folderId: string | null | undefined,
    propertyId: string | null,
  ): Promise<void> {
    if (!folderId) return;
    if (!propertyId) {
      throw new BadRequestException(
        'Cannot file this document into a folder',
      );
    }
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { propertyId: true },
    });
    if (!folder || folder.propertyId !== propertyId) {
      throw new BadRequestException(
        'Folder does not belong to this property',
      );
    }
  }

  /** Resolve the property a document is filed under (direct or via its lease). */
  private async resolvePropertyId(document: {
    propertyId: string | null;
    leaseId: string | null;
  }): Promise<string | null> {
    if (document.propertyId) return document.propertyId;
    if (document.leaseId) {
      const lease = await this.prisma.lease.findUnique({
        where: { id: document.leaseId },
        select: { propertyId: true },
      });
      return lease?.propertyId ?? null;
    }
    return null;
  }

  // ============================================
  // Update / Delete (business)
  // ============================================

  async update(
    id: string,
    dto: UpdateDocumentDto,
    userId: string,
  ): Promise<DocumentResponse> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { lease: { include: { property: true } } },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const canModify = await this.canModifyDocument(document, userId);
    if (!canModify) {
      throw new ForbiddenException(
        'You do not have permission to update this document',
      );
    }

    // Moving into a folder: validate it belongs to this document's property.
    if (dto.folderId !== undefined) {
      const propertyId = await this.resolvePropertyId(document);
      await this.assertFolderInProperty(dto.folderId, propertyId);
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.permission !== undefined
          ? { permission: dto.permission }
          : {}),
        ...(dto.folderId !== undefined ? { folderId: dto.folderId } : {}),
      },
      include: { storedFile: true },
    });

    const propertyId = await this.resolvePropertyId(updated);

    // Emit a focused audit entry per kind of change.
    if (dto.name !== undefined && dto.name !== document.name) {
      this.logAudit(DocumentAuditAction.RENAME, {
        documentId: id,
        propertyId,
        actorId: userId,
        metadata: { from: document.name, to: dto.name },
      });
    }
    if (dto.permission !== undefined && dto.permission !== document.permission) {
      this.logAudit(DocumentAuditAction.PERMISSION_CHANGE, {
        documentId: id,
        propertyId,
        actorId: userId,
        metadata: { from: document.permission, to: dto.permission },
      });
    }
    if (dto.folderId !== undefined && dto.folderId !== document.folderId) {
      this.logAudit(DocumentAuditAction.MOVE, {
        documentId: id,
        propertyId,
        actorId: userId,
        metadata: { from: document.folderId, to: dto.folderId },
      });
    }

    return this.toDto(updated);
  }

  /**
   * Delete a document and its underlying file (if any). Consistency: the
   * business row is removed first, then the StoredFile + storage object.
   */
  async delete(id: string, userId: string): Promise<void> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { lease: { include: { property: true } } },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const canModify = await this.canModifyDocument(document, userId);
    if (!canModify) {
      throw new ForbiddenException(
        'You do not have permission to delete this document',
      );
    }

    const propertyId = await this.resolvePropertyId(document);
    const storedFileId = document.storedFileId;
    const name = document.name;

    await this.prisma.document.delete({ where: { id } });
    if (storedFileId) {
      await this.storedFileService.delete(storedFileId);
    }

    // documentId is intentionally null: the row is gone, but the audit trail
    // survives via the denormalized propertyId + metadata.
    this.logAudit(DocumentAuditAction.DELETE, {
      documentId: null,
      propertyId,
      actorId: userId,
      metadata: { deletedDocumentId: id, name },
    });
  }

  /** Backward-compatible alias: deletes the document and its file. */
  async deleteWithFile(id: string, userId: string): Promise<void> {
    return this.delete(id, userId);
  }

  // ============================================
  // Bulk actions (selection mode)
  // ============================================

  /** Delete multiple documents (and their files). Each is authorized. */
  async bulkDelete(dto: BulkDeleteDocumentsDto, userId: string): Promise<void> {
    for (const id of dto.ids) {
      await this.delete(id, userId);
    }
  }

  /** Move multiple documents into a folder (or to the root when null). */
  async bulkMove(
    dto: BulkMoveDocumentsDto,
    userId: string,
  ): Promise<DocumentResponse[]> {
    const results: DocumentResponse[] = [];
    for (const id of dto.ids) {
      results.push(
        await this.update(id, { folderId: dto.folderId ?? null }, userId),
      );
    }
    return results;
  }

  // ============================================
  // Upload (server-side, multipart)
  // ============================================

  async uploadDocument(
    propertyId: string,
    file: Express.Multer.File,
    name: string,
    category: string,
    userId: string,
    permission?: DocumentPermission,
    folderId?: string,
  ): Promise<DocumentResponse> {
    const isOwner = await this.propertiesService.isOwner(propertyId, userId);
    if (!isOwner) {
      throw new ForbiddenException(
        'Only the property owner can upload documents',
      );
    }

    await this.assertFolderInProperty(folderId, propertyId);

    const storedFile = await this.storedFileService.upload({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      keyParts: ['properties', propertyId, 'documents'],
      uploadedById: userId,
    });

    const document = await this.prisma.document.create({
      data: {
        name,
        category: category as DocumentCategory,
        permission,
        folderId: folderId ?? null,
        propertyId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    this.logAudit(DocumentAuditAction.UPLOAD, {
      documentId: document.id,
      propertyId,
      actorId: userId,
      metadata: { name, category },
    });

    await this.enqueueAi(document.id, userId);

    return this.toDto(document);
  }

  async uploadLeaseDocument(
    leaseId: string,
    file: Express.Multer.File,
    name: string,
    category: string,
    userId: string,
    permission?: DocumentPermission,
    folderId?: string,
  ): Promise<DocumentResponse> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { property: { select: { ownerId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
    if (lease.property.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the property owner can upload documents',
      );
    }

    await this.assertFolderInProperty(folderId, lease.propertyId);

    const storedFile = await this.storedFileService.upload({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      keyParts: ['leases', leaseId, 'documents'],
      uploadedById: userId,
    });

    const document = await this.prisma.document.create({
      data: {
        name,
        category: category as DocumentCategory,
        permission,
        folderId: folderId ?? null,
        leaseId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    this.logAudit(DocumentAuditAction.UPLOAD, {
      documentId: document.id,
      propertyId: lease.propertyId,
      actorId: userId,
      metadata: { name, category, leaseId },
    });

    await this.enqueueAi(document.id, userId);

    return this.toDto(document);
  }

  // ============================================
  // Maintenance receipts — a RECEIPT-category Document, cross-linked to a
  // MaintenanceRequest, so a future accounting module can query every
  // receipt directly without scanning maintenance conversations.
  // ============================================

  private async getReceiptEligibleRequestOrThrow(
    requestId: string,
    userId: string,
  ) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, propertyId: true, requesterId: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    const isOwner = await this.propertiesService.isOwner(
      request.propertyId,
      userId,
    );
    const isRequester = request.requesterId === userId;
    if (!isOwner && !isRequester) {
      throw new ForbiddenException(
        'You do not have access to this maintenance request',
      );
    }

    return request;
  }

  async uploadMaintenanceReceipt(
    requestId: string,
    file: Express.Multer.File,
    name: string,
    userId: string,
  ): Promise<DocumentResponse> {
    const request = await this.getReceiptEligibleRequestOrThrow(
      requestId,
      userId,
    );

    if (request.status !== MaintenanceStatus.RESOLVED) {
      throw new BadRequestException(
        'Receipts can only be uploaded once the maintenance request is completed',
      );
    }

    const storedFile = await this.storedFileService.upload({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      keyParts: ['maintenance', requestId, 'receipts'],
      uploadedById: userId,
    });

    const document = await this.prisma.document.create({
      data: {
        name,
        category: DocumentCategory.RECEIPT,
        permission: DocumentPermission.LANDLORD_AND_TENANT,
        propertyId: request.propertyId,
        maintenanceRequestId: requestId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    // File the receipt under Receipts/<taxYear> and record its metadata
    // (source MAINTENANCE, linked back to the request). Same file — no dup.
    await this.receiptsService.registerReceipt(document, {
      source: ReceiptSource.MAINTENANCE,
      actorId: userId,
      relatedMaintenanceId: requestId,
    });

    this.logAudit(DocumentAuditAction.UPLOAD, {
      documentId: document.id,
      propertyId: request.propertyId,
      actorId: userId,
      metadata: { name, category: DocumentCategory.RECEIPT, requestId },
    });

    await this.enqueueAi(document.id, userId);

    // Re-read so the response reflects the folder assignment from registerReceipt.
    const filed = await this.prisma.document.findUniqueOrThrow({
      where: { id: document.id },
      include: { storedFile: true },
    });
    return this.toDto(filed);
  }

  async findReceiptsForMaintenanceRequest(
    requestId: string,
    userId: string,
  ): Promise<DocumentResponse[]> {
    await this.getReceiptEligibleRequestOrThrow(requestId, userId);

    const documents = await this.prisma.document.findMany({
      where: { maintenanceRequestId: requestId },
      include: { storedFile: true },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((d) => this.toDto(d));
  }

  // ============================================
  // Upload (client-side, pre-signed URL)
  // ============================================

  async getUploadUrl(
    propertyId: string,
    dto: GetUploadUrlDto,
    userId: string,
  ): Promise<{ uploadUrl: string; document: DocumentResponse }> {
    const isOwner = await this.propertiesService.isOwner(propertyId, userId);
    if (!isOwner) {
      throw new ForbiddenException(
        'Only the property owner can upload documents',
      );
    }

    await this.assertFolderInProperty(dto.folderId, propertyId);

    const { storedFile, uploadUrl } =
      await this.storedFileService.createForPresignedUpload({
        originalFilename: dto.filename,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        keyParts: ['properties', propertyId, 'documents'],
        uploadedById: userId,
      });

    const document = await this.prisma.document.create({
      data: {
        name: dto.name,
        category: dto.category,
        permission: dto.permission,
        folderId: dto.folderId ?? null,
        propertyId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    this.logAudit(DocumentAuditAction.UPLOAD, {
      documentId: document.id,
      propertyId,
      actorId: userId,
      metadata: { name: dto.name, category: dto.category },
    });

    return { uploadUrl, document: this.toDto(document) };
  }

  async getLeaseUploadUrl(
    leaseId: string,
    dto: GetUploadUrlDto,
    userId: string,
  ): Promise<{ uploadUrl: string; document: DocumentResponse }> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { property: { select: { ownerId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
    if (lease.property.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the property owner can upload lease documents',
      );
    }

    await this.assertFolderInProperty(dto.folderId, lease.propertyId);

    const { storedFile, uploadUrl } =
      await this.storedFileService.createForPresignedUpload({
        originalFilename: dto.filename,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        keyParts: ['leases', leaseId, 'documents'],
        uploadedById: userId,
      });

    const document = await this.prisma.document.create({
      data: {
        name: dto.name,
        category: dto.category,
        permission: dto.permission,
        folderId: dto.folderId ?? null,
        leaseId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    this.logAudit(DocumentAuditAction.UPLOAD, {
      documentId: document.id,
      propertyId: lease.propertyId,
      actorId: userId,
      metadata: { name: dto.name, category: dto.category, leaseId },
    });

    return { uploadUrl, document: this.toDto(document) };
  }

  // ============================================
  // Download / Preview
  // ============================================

  /** Time-limited signed download URL for a document's file. */
  async getDownloadUrl(id: string, userId: string): Promise<string> {
    const { url } = await this.getSignedUrl(
      id,
      userId,
      DocumentAuditAction.DOWNLOAD,
    );
    return url;
  }

  /**
   * Signed URL for in-app preview, plus the mime type so the client can choose
   * a renderer (image / PDF / open-externally). Logs a PREVIEW action.
   */
  async getPreviewUrl(
    id: string,
    userId: string,
  ): Promise<{ url: string; mimeType: string }> {
    return this.getSignedUrl(id, userId, DocumentAuditAction.PREVIEW);
  }

  private async getSignedUrl(
    id: string,
    userId: string,
    action: DocumentAuditAction,
  ): Promise<{ url: string; mimeType: string }> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { storedFile: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const hasAccess = await this.checkDocumentAccess(document, userId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this document');
    }

    if (!document.storedFile) {
      throw new BadRequestException('This document has no file');
    }

    const url = await this.storedFileService.getDownloadUrl(
      document.storedFile,
    );

    const propertyId = await this.resolvePropertyId(document);
    this.logAudit(action, {
      documentId: id,
      propertyId,
      actorId: userId,
    });

    return { url, mimeType: document.storedFile.mimeType };
  }

  // ============================================
  // Required Documents workflow
  // ============================================

  /**
   * Landlord requests a document from a tenant. Creates a REQUESTED document
   * (no file yet) on the lease and notifies the tenant.
   */
  async requestDocument(
    leaseId: string,
    dto: RequestDocumentDto,
    userId: string,
  ): Promise<DocumentResponse> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { property: { select: { ownerId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
    if (lease.property.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the property owner can request documents',
      );
    }

    const document = await this.prisma.document.create({
      data: {
        name: dto.name,
        category: dto.category,
        // Required documents are always shared with the tenant.
        permission: DocumentPermission.LANDLORD_AND_TENANT,
        status: DocumentStatus.REQUESTED,
        requestedAt: new Date(),
        leaseId,
      },
      include: { storedFile: true },
    });

    // The lease may not have a tenant yet (unassigned); notify only if it does.
    if (lease.tenantId) {
      await this.notifications.notifyDocumentRequested(
        lease.tenantId,
        document.name,
        lease.propertyId,
      );
    }

    return this.toDto(document);
  }

  /**
   * Tenant uploads a file to fulfill a requested document. Marks it RECEIVED
   * and notifies the landlord. Re-fulfilling replaces (and cleans up) the file.
   */
  async fulfillRequest(
    documentId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<DocumentResponse> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        lease: {
          include: { property: { select: { ownerId: true } } },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (!document.leaseId || !document.lease) {
      throw new BadRequestException(
        'This document is not a lease document request',
      );
    }
    if (
      document.status !== DocumentStatus.REQUESTED &&
      document.status !== DocumentStatus.RECEIVED
    ) {
      throw new BadRequestException('This document was not requested');
    }
    if (document.lease.tenantId !== userId) {
      throw new ForbiddenException(
        'Only the tenant can upload this requested document',
      );
    }

    const previousStoredFileId = document.storedFileId;

    const storedFile = await this.storedFileService.upload({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      keyParts: ['leases', document.leaseId, 'documents'],
      uploadedById: userId,
    });

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.RECEIVED,
        receivedAt: new Date(),
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    // Replace: clean up the previously-uploaded file, if any.
    if (previousStoredFileId && previousStoredFileId !== storedFile.id) {
      await this.storedFileService.delete(previousStoredFileId);
    }

    this.logAudit(DocumentAuditAction.UPLOAD, {
      documentId: updated.id,
      propertyId: document.lease.propertyId,
      actorId: userId,
      metadata: { name: updated.name, fulfilledRequest: true },
    });

    const tenant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const tenantName = tenant
      ? `${tenant.firstName} ${tenant.lastName}`
      : 'The tenant';

    await this.notifications.notifyRequestedDocumentUploaded(
      document.lease.property.ownerId,
      tenantName,
      updated.name,
      document.lease.propertyId,
    );

    await this.enqueueAi(updated.id, userId);

    return this.toDto(updated);
  }
}

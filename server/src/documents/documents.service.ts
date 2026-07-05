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
  DocumentVisibility,
  StoredFile,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { StoredFileService } from '../media/stored-file.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { GetUploadUrlDto } from './dto/upload-document.dto';
import { RequestDocumentDto } from './dto/request-document.dto';

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
  name: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
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
  ) {}

  /** Assemble the public DTO from a document and its (optional) StoredFile. */
  private toDto(doc: DocumentWithFile): DocumentResponse {
    const sf = doc.storedFile ?? null;
    const dto: DocumentResponse = {
      id: doc.id,
      propertyId: doc.propertyId,
      leaseId: doc.leaseId,
      name: doc.name,
      category: doc.category,
      visibility: doc.visibility,
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

    // Owners see everything; tenants only see SHARED documents.
    const isOwner = await this.propertiesService.isOwner(propertyId, userId);

    const documents = await this.prisma.document.findMany({
      where: {
        propertyId,
        ...(isOwner ? {} : { visibility: DocumentVisibility.SHARED }),
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
        // Owners see everything; tenants only see SHARED documents (required
        // documents are created SHARED, so they remain visible to the tenant).
        ...(isOwner ? {} : { visibility: DocumentVisibility.SHARED }),
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
    document: { propertyId?: string | null; leaseId?: string | null; lease?: any },
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

    const updated = await this.prisma.document.update({
      where: { id },
      data: dto,
      include: { storedFile: true },
    });

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

    const storedFileId = document.storedFileId;
    await this.prisma.document.delete({ where: { id } });
    if (storedFileId) {
      await this.storedFileService.delete(storedFileId);
    }
  }

  /** Backward-compatible alias: deletes the document and its file. */
  async deleteWithFile(id: string, userId: string): Promise<void> {
    return this.delete(id, userId);
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
    visibility?: DocumentVisibility,
  ): Promise<DocumentResponse> {
    const isOwner = await this.propertiesService.isOwner(propertyId, userId);
    if (!isOwner) {
      throw new ForbiddenException('Only the property owner can upload documents');
    }

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
        visibility,
        propertyId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    return this.toDto(document);
  }

  async uploadLeaseDocument(
    leaseId: string,
    file: Express.Multer.File,
    name: string,
    category: string,
    userId: string,
    visibility?: DocumentVisibility,
  ): Promise<DocumentResponse> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { property: { select: { ownerId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
    if (lease.property.ownerId !== userId) {
      throw new ForbiddenException('Only the property owner can upload documents');
    }

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
        visibility,
        leaseId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    return this.toDto(document);
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
      throw new ForbiddenException('Only the property owner can upload documents');
    }

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
        visibility: dto.visibility,
        propertyId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
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
        visibility: dto.visibility,
        leaseId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    return { uploadUrl, document: this.toDto(document) };
  }

  // ============================================
  // Download
  // ============================================

  /** Time-limited signed download URL for a document's file. */
  async getDownloadUrl(id: string, userId: string): Promise<string> {
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
      throw new BadRequestException('This document has no file to download');
    }

    return this.storedFileService.getDownloadUrl(document.storedFile);
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
        visibility: DocumentVisibility.SHARED,
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

    return this.toDto(updated);
  }
}

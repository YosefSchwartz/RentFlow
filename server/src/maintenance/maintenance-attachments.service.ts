import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { MaintenanceAttachment, StoredFile, MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { StoredFileService } from '../media/stored-file.service';
import { validateMediaFile } from '../media/media-validation';

// Maximum attachments allowed per maintenance request.
const MAX_ATTACHMENTS_PER_REQUEST = 20;

type AttachmentWithFile = MaintenanceAttachment & { storedFile: StoredFile };

/** Response shape (unchanged contract): business fields + file info, no storage internals. */
export interface MaintenanceAttachmentResponse {
  id: string;
  maintenanceRequestId: string;
  type: MediaType;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedById: string | null;
  createdAt: Date;
}

@Injectable()
export class MaintenanceAttachmentsService {
  private readonly logger = new Logger(MaintenanceAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly propertiesService: PropertiesService,
    private readonly storedFileService: StoredFileService,
  ) {}

  /**
   * The storage bucket is private (no public read access), so the URL the
   * client renders directly (grid thumbnails, full-screen viewer) must be a
   * signed, time-limited download URL rather than the bare public URL.
   */
  private async toResponse(
    attachment: AttachmentWithFile,
  ): Promise<MaintenanceAttachmentResponse> {
    const file = this.storedFileService.toDto(attachment.storedFile);
    const url = await this.storedFileService.getDownloadUrl(
      attachment.storedFile,
    );
    return {
      id: attachment.id,
      maintenanceRequestId: attachment.maintenanceRequestId,
      type: attachment.type,
      url,
      fileName: file.originalFilename,
      mimeType: file.mimeType,
      size: file.size,
      uploadedById: attachment.uploadedById,
      createdAt: attachment.createdAt,
    };
  }

  private async getRequestOrThrow(requestId: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, propertyId: true, requesterId: true },
    });
    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }
    return request;
  }

  /**
   * List attachments for a request. Anyone with property access (owner or
   * tenant) may view.
   */
  async findAllForRequest(
    requestId: string,
    userId: string,
  ): Promise<MaintenanceAttachmentResponse[]> {
    const request = await this.getRequestOrThrow(requestId);

    const hasAccess = await this.propertiesService.userHasAccess(
      request.propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this maintenance request',
      );
    }

    const attachments = await this.prisma.maintenanceAttachment.findMany({
      where: { maintenanceRequestId: requestId },
      include: { storedFile: true },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(attachments.map((a) => this.toResponse(a)));
  }

  /**
   * Attach a media file to a request. Anyone with property access may attach
   * (the tenant attaches evidence when reporting; the owner may add as well).
   */
  async upload(
    requestId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<MaintenanceAttachmentResponse> {
    const request = await this.getRequestOrThrow(requestId);

    const hasAccess = await this.propertiesService.userHasAccess(
      request.propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this maintenance request',
      );
    }

    // Validate type + size (image <= 10MB, video <= 50MB).
    const type = validateMediaFile(file.mimetype, file.size);

    // Enforce the per-request limit.
    const count = await this.prisma.maintenanceAttachment.count({
      where: { maintenanceRequestId: requestId },
    });
    if (count >= MAX_ATTACHMENTS_PER_REQUEST) {
      throw new BadRequestException(
        `This request already has the maximum of ${MAX_ATTACHMENTS_PER_REQUEST} attachments.`,
      );
    }

    this.logger.log(`Uploading attachment for request ${requestId}`);

    const storedFile = await this.storedFileService.upload({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      keyParts: ['maintenance', requestId, 'attachments'],
      uploadedById: userId,
    });

    const created = await this.prisma.maintenanceAttachment.create({
      data: {
        type,
        maintenanceRequestId: requestId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    return this.toResponse(created);
  }

  /** Delete an attachment. The uploader or the property owner may delete. */
  async delete(attachmentId: string, userId: string): Promise<void> {
    const attachment = await this.prisma.maintenanceAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        maintenanceRequest: { select: { propertyId: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const isUploader = attachment.uploadedById === userId;
    const isOwner = await this.propertiesService.isOwner(
      attachment.maintenanceRequest.propertyId,
      userId,
    );
    if (!isUploader && !isOwner) {
      throw new ForbiddenException(
        'You do not have permission to delete this attachment',
      );
    }

    // Remove the business row first (releases the RESTRICT FK), then the file.
    await this.prisma.maintenanceAttachment.delete({
      where: { id: attachmentId },
    });
    await this.storedFileService.delete(attachment.storedFileId);
  }
}

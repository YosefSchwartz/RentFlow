import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PropertyMedia, StoredFile, MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { StoredFileService } from '../media/stored-file.service';
import { validateMediaFile } from '../media/media-validation';

// Maximum media items allowed per property.
const MAX_MEDIA_PER_PROPERTY = 100;

type PropertyMediaWithFile = PropertyMedia & { storedFile: StoredFile };

/** Response shape (unchanged contract): business fields + file info, no storage internals. */
export interface PropertyMediaResponse {
  id: string;
  propertyId: string;
  type: MediaType;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedById: string | null;
  createdAt: Date;
}

@Injectable()
export class PropertyMediaService {
  private readonly logger = new Logger(PropertyMediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly propertiesService: PropertiesService,
    private readonly storedFileService: StoredFileService,
  ) {}

  /**
   * Map a media row (+ its StoredFile) to the public response shape.
   *
   * The storage bucket is private (no public read access), so the URL the
   * client renders directly (grid thumbnails, full-screen viewer) must be a
   * signed, time-limited download URL rather than the bare public URL.
   */
  private async toResponse(
    media: PropertyMediaWithFile,
  ): Promise<PropertyMediaResponse> {
    const file = this.storedFileService.toDto(media.storedFile);
    const url = await this.storedFileService.getDownloadUrl(media.storedFile);
    return {
      id: media.id,
      propertyId: media.propertyId,
      type: media.type,
      url,
      fileName: file.originalFilename,
      mimeType: file.mimeType,
      size: file.size,
      uploadedById: media.uploadedById,
      createdAt: media.createdAt,
    };
  }

  /** List all media for a property. Owner or active tenant may view. */
  async findAllForProperty(
    propertyId: string,
    userId: string,
  ): Promise<PropertyMediaResponse[]> {
    const hasAccess = await this.propertiesService.userHasAccess(
      propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this property');
    }

    const media = await this.prisma.propertyMedia.findMany({
      where: { propertyId },
      include: { storedFile: true },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(media.map((m) => this.toResponse(m)));
  }

  /** Upload a media file to a property's gallery. Only the owner may upload. */
  async upload(
    propertyId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<PropertyMediaResponse> {
    const isOwner = await this.propertiesService.isOwner(propertyId, userId);
    if (!isOwner) {
      throw new ForbiddenException('Only the property owner can upload media');
    }

    // Validate type + size (image <= 10MB, video <= 50MB).
    const type = validateMediaFile(file.mimetype, file.size);

    // Enforce the per-property limit.
    const count = await this.prisma.propertyMedia.count({
      where: { propertyId },
    });
    if (count >= MAX_MEDIA_PER_PROPERTY) {
      throw new BadRequestException(
        `This property already has the maximum of ${MAX_MEDIA_PER_PROPERTY} media items.`,
      );
    }

    this.logger.log(`Uploading media for property ${propertyId}`);

    const storedFile = await this.storedFileService.upload({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      keyParts: [
        'properties',
        propertyId,
        type === MediaType.VIDEO ? 'videos' : 'photos',
      ],
      uploadedById: userId,
    });

    const created = await this.prisma.propertyMedia.create({
      data: {
        type,
        propertyId,
        uploadedById: userId,
        storedFileId: storedFile.id,
      },
      include: { storedFile: true },
    });

    return this.toResponse(created);
  }

  /** Delete a media item and its underlying file. Only the owner may delete. */
  async delete(mediaId: string, userId: string): Promise<void> {
    const media = await this.prisma.propertyMedia.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    const isOwner = await this.propertiesService.isOwner(
      media.propertyId,
      userId,
    );
    if (!isOwner) {
      throw new ForbiddenException('Only the property owner can delete media');
    }

    // Remove the business row first (releases the RESTRICT FK), then the file.
    await this.prisma.propertyMedia.delete({ where: { id: mediaId } });
    await this.storedFileService.delete(media.storedFileId);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoredFile } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/** Server-side upload through the unified media pipeline. */
export interface StoredFileUploadParams {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  /** Key namespace segments, e.g. ['properties', propertyId, 'documents']. */
  keyParts: string[];
  uploadedById?: string;
  // Optional pre-computed media metadata (future: thumbnails / probing).
  imageWidth?: number;
  imageHeight?: number;
  videoDuration?: number;
}

/** Client-side (pre-signed) upload registration. */
export interface StoredFilePresignParams {
  originalFilename: string;
  mimeType: string;
  fileSize?: number;
  keyParts: string[];
  uploadedById?: string;
  expiresIn?: number;
}

/** The business-safe view of a stored file (never exposes storageKey/bucket). */
export interface MediaFileDto {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  /** Non-signed URL for inline preview / download. */
  url: string;
  uploadedById: string | null;
  uploadedAt: Date;
}

/**
 * The single media pipeline for ALL of KeyNest.
 *
 * Every uploaded file — documents, property photos/videos, maintenance
 * attachments, and future lease documents / inspection reports / signatures —
 * flows through here:
 *
 *   validate (caller) → generate UUID → build storage key → upload via
 *   StorageService → persist StoredFile → (caller links it to a business entity)
 *
 * StoredFileService is the ONLY place that creates StoredFile rows or turns a
 * StoredFile into a client-facing URL. Business modules never touch storage
 * keys, buckets, or the AWS SDK.
 */
@Injectable()
export class StoredFileService {
  private readonly logger = new Logger(StoredFileService.name);
  private readonly providerName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.providerName = this.configService.get<string>('STORAGE_PROVIDER', 's3');
  }

  /** Lowercased, sanitized file extension from a filename (no leading dot). */
  private extensionOf(filename: string): string | undefined {
    const idx = filename.lastIndexOf('.');
    if (idx < 0 || idx === filename.length - 1) return undefined;
    const ext = filename.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
    return ext || undefined;
  }

  /**
   * Build a UUID-based storage key. The original filename is NEVER used in the
   * key — only its extension, for content-type friendliness.
   * e.g. `properties/<id>/documents/<uuid>.pdf`
   */
  buildStorageKey(keyParts: string[], originalFilename: string): string {
    const ext = this.extensionOf(originalFilename);
    const prefix = keyParts.join('/');
    return `${prefix}/${uuidv4()}${ext ? `.${ext}` : ''}`;
  }

  /** Full server-side upload pipeline. Returns the persisted StoredFile. */
  async upload(params: StoredFileUploadParams): Promise<StoredFile> {
    const storageKey = this.buildStorageKey(
      params.keyParts,
      params.originalFilename,
    );

    const metadata: Record<string, string> = {
      'original-filename': params.originalFilename,
    };
    if (params.uploadedById) metadata['uploaded-by'] = params.uploadedById;

    await this.storageService.uploadFile({
      key: storageKey,
      body: params.buffer,
      contentType: params.mimeType,
      metadata,
    });

    return this.persist(storageKey, params);
  }

  /**
   * Register a StoredFile for a client-side (pre-signed) upload and return the
   * upload URL. The bytes are uploaded directly by the client afterwards.
   */
  async createForPresignedUpload(
    params: StoredFilePresignParams,
  ): Promise<{ storedFile: StoredFile; uploadUrl: string }> {
    const storageKey = this.buildStorageKey(
      params.keyParts,
      params.originalFilename,
    );

    const uploadUrl = await this.storageService.generateUploadUrl(
      storageKey,
      params.mimeType,
      params.expiresIn,
    );

    const storedFile = await this.persist(storageKey, {
      originalFilename: params.originalFilename,
      mimeType: params.mimeType,
      fileSize: params.fileSize ?? 0,
      uploadedById: params.uploadedById,
    });

    return { storedFile, uploadUrl };
  }

  private persist(
    storageKey: string,
    params: {
      originalFilename: string;
      mimeType: string;
      fileSize: number;
      uploadedById?: string;
      imageWidth?: number;
      imageHeight?: number;
      videoDuration?: number;
    },
  ): Promise<StoredFile> {
    return this.prisma.storedFile.create({
      data: {
        storageKey,
        originalFilename: params.originalFilename,
        mimeType: params.mimeType,
        fileExtension: this.extensionOf(params.originalFilename),
        fileSize: params.fileSize,
        storageProvider: this.providerName,
        uploadedById: params.uploadedById ?? null,
        imageWidth: params.imageWidth,
        imageHeight: params.imageHeight,
        videoDuration: params.videoDuration,
      },
    });
  }

  /**
   * Delete a StoredFile: removes the underlying object (best-effort) then the
   * row. The caller MUST have already removed the referencing business row
   * (the FK is RESTRICT for required references).
   */
  async delete(storedFileId: string): Promise<void> {
    const stored = await this.prisma.storedFile.findUnique({
      where: { id: storedFileId },
    });
    if (!stored) return;

    try {
      await this.storageService.deleteFile(stored.storageKey);
    } catch (error) {
      this.logger.warn(
        `Failed to delete object ${stored.storageKey} from storage`,
        error as Error,
      );
      // Proceed with row deletion to avoid a dangling DB row.
    }

    await this.prisma.storedFile.delete({ where: { id: storedFileId } });
  }

  /** Non-signed public URL (inline preview / download). */
  getPublicUrl(storedFile: Pick<StoredFile, 'storageKey'>): string {
    return this.storageService.getPublicUrl(storedFile.storageKey);
  }

  /** Time-limited signed download URL. */
  getDownloadUrl(
    storedFile: Pick<StoredFile, 'storageKey'>,
    expiresIn?: number,
  ): Promise<string> {
    return this.storageService.generateDownloadUrl(
      storedFile.storageKey,
      expiresIn,
    );
  }

  /** Map a StoredFile to the business-safe DTO (no storage internals). */
  toDto(storedFile: StoredFile): MediaFileDto {
    return {
      id: storedFile.id,
      originalFilename: storedFile.originalFilename,
      mimeType: storedFile.mimeType,
      size: storedFile.fileSize,
      url: this.getPublicUrl(storedFile),
      uploadedById: storedFile.uploadedById,
      uploadedAt: storedFile.createdAt,
    };
  }
}

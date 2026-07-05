import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StorageProvider,
  STORAGE_PROVIDER,
  StorageWriteResult,
  DownloadedFile,
  StorageObjectMetadata,
} from './interfaces/storage-provider.interface';

/** Write a file to a precomputed storage key. */
export interface PutFileOptions {
  /** Full object key. Built by the media layer; StorageService never invents keys. */
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

/**
 * Thin, key-only facade over the storage backend.
 *
 * StorageService deals EXCLUSIVELY with storage keys — it knows nothing about
 * documents, media, or how keys are structured (that lives in the media layer,
 * StoredFileService). It owns only the configured bucket and the
 * provider-agnostic public-URL / key-parsing helpers, delegating all I/O to the
 * injected StorageProvider so the backend (S3 → CloudFront → …) is swappable.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
    private readonly configService: ConfigService,
  ) {
    this.bucket =
      this.configService.get<string>('AWS_S3_BUCKET') ||
      this.configService.get<string>('S3_BUCKET_NAME', 'keynest-local-documents');
  }

  /** Write a file at the given key (server-side upload). */
  async uploadFile(options: PutFileOptions): Promise<StorageWriteResult> {
    this.logger.log(`Uploading object ${options.key}`);
    return this.storageProvider.uploadFile({
      bucket: this.bucket,
      key: options.key,
      body: options.body,
      contentType: options.contentType,
      metadata: options.metadata,
    });
  }

  /** Pre-signed URL for a client to upload directly to the given key. */
  async generateUploadUrl(
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<string> {
    return this.storageProvider.generateUploadUrl({
      bucket: this.bucket,
      key,
      contentType,
      expiresIn,
    });
  }

  /**
   * Time-limited download URL. Callers never need to know whether this is an S3
   * pre-signed URL or (future) a CloudFront signed URL.
   */
  async generateDownloadUrl(key: string, expiresIn?: number): Promise<string> {
    return this.storageProvider.generateDownloadUrl({
      bucket: this.bucket,
      key,
      expiresIn,
    });
  }

  /** Read an object's contents (server-side download). */
  async downloadFile(key: string): Promise<DownloadedFile> {
    return this.storageProvider.downloadFile(key, this.bucket);
  }

  /** Delete an object by key. */
  async deleteFile(key: string): Promise<void> {
    this.logger.log(`Deleting object ${key}`);
    await this.storageProvider.deleteFile(key, this.bucket);
  }

  /** Whether an object exists. */
  async fileExists(key: string): Promise<boolean> {
    return this.storageProvider.fileExists(key, this.bucket);
  }

  /** Object metadata (size, content type, …). */
  async getObjectMetadata(key: string): Promise<StorageObjectMetadata> {
    return this.storageProvider.getObjectMetadata(key, this.bucket);
  }

  /** Non-signed public URL for a key (used for inline preview / CDN). */
  getPublicUrl(key: string): string {
    return this.storageProvider.getPublicUrl(key, this.bucket);
  }

  /**
   * Parse the storage key out of a stored URL (handles LocalStack path-style
   * and AWS virtual-hosted-style). Retained for data migration / legacy URLs.
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      if (pathname.startsWith(`/${this.bucket}/`)) {
        return pathname.substring(`/${this.bucket}/`.length);
      }
      return pathname.startsWith('/') ? pathname.substring(1) : pathname;
    } catch {
      return null;
    }
  }
}

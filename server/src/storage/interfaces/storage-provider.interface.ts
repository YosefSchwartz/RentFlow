/**
 * Storage abstraction.
 *
 * A StorageProvider is the ONLY place allowed to talk to a concrete storage
 * backend (AWS S3 / LocalStack today, CloudFront-signed downloads in the
 * future). No SDK type ever crosses this boundary — business modules depend
 * solely on StorageService, which depends on this interface.
 *
 * Method names are intentionally generic (file/object, not "document") so the
 * same layer serves documents, property photos/videos, maintenance
 * attachments and any future media type.
 */

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

/** A file to write to storage. */
export interface PutFileParams {
  /** Target bucket; falls back to the provider's configured bucket. */
  bucket?: string;
  /** Full object key (path) within the bucket. */
  key: string;
  /** Raw file contents. */
  body: Buffer;
  /** MIME type stored alongside the object. */
  contentType: string;
  /** Optional informational metadata stored with the object. */
  metadata?: Record<string, string>;
}

/** Result of a successful write (a raw storage object, not the StoredFile entity). */
export interface StorageWriteResult {
  /** The object key it was stored under. */
  key: string;
  /** A non-signed public URL (used as the canonical reference / for CDN). */
  url: string;
  /** Backend entity tag, when available. */
  etag?: string;
}

/** Contents returned by a server-side download. */
export interface DownloadedFile {
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

/** Metadata about a stored object. */
export interface StorageObjectMetadata {
  key: string;
  size?: number;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

/** Parameters for a pre-signed (time-limited) download URL. */
export interface SignedDownloadParams {
  bucket?: string;
  key: string;
  /** URL lifetime in seconds (default: 3600). */
  expiresIn?: number;
}

/** Parameters for a pre-signed (time-limited) upload URL. */
export interface SignedUploadParams {
  bucket?: string;
  key: string;
  contentType: string;
  /** URL lifetime in seconds (default: 3600). */
  expiresIn?: number;
}

export interface StorageProvider {
  /** Write a file (server-side upload). */
  uploadFile(params: PutFileParams): Promise<StorageWriteResult>;

  /** Read a file's contents (server-side download). */
  downloadFile(key: string, bucket?: string): Promise<DownloadedFile>;

  /** Permanently delete a file. No-op-safe if it does not exist. */
  deleteFile(key: string, bucket?: string): Promise<void>;

  /**
   * Generate a time-limited URL the client can use to download a file.
   * (S3 pre-signed today; CloudFront signed URL in the future — callers are
   * unaffected by which one is used.)
   */
  generateDownloadUrl(params: SignedDownloadParams): Promise<string>;

  /** Generate a time-limited URL the client can use to upload directly. */
  generateUploadUrl(params: SignedUploadParams): Promise<string>;

  /** Fetch object metadata (size, content type, etc.). */
  getObjectMetadata(
    key: string,
    bucket?: string,
  ): Promise<StorageObjectMetadata>;

  /** Whether an object exists. */
  fileExists(key: string, bucket?: string): Promise<boolean>;

  /** Build the non-signed public URL for a key. */
  getPublicUrl(key: string, bucket?: string): string;
}

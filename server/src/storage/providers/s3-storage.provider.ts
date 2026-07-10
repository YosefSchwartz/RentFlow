import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StorageProvider,
  PutFileParams,
  StorageWriteResult,
  DownloadedFile,
  StorageObjectMetadata,
  SignedDownloadParams,
  SignedUploadParams,
} from '../interfaces/storage-provider.interface';
import {
  StorageException,
  StorageObjectNotFoundException,
} from '../storage.exceptions';

const DEFAULT_EXPIRES_IN = 3600;

/**
 * AWS S3 / LocalStack implementation of StorageProvider.
 *
 * This is the ONLY class in the backend that imports the AWS SDK. Every SDK
 * call is wrapped so that callers receive normalized StorageException /
 * StorageObjectNotFoundException errors instead of raw SDK errors.
 *
 * LocalStack vs. real AWS is purely configuration: when AWS_ENDPOINT is set we
 * target LocalStack (path-style URLs); otherwise we target real AWS.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly defaultBucket: string;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;
  private readonly region: string;
  private readonly isLocalStack: boolean;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'eu-central-1');
    this.defaultBucket =
      this.configService.get<string>('AWS_S3_BUCKET') ||
      this.configService.get<string>('S3_BUCKET_NAME', 'keynest-local-documents');
    this.endpoint = this.configService.get<string>('AWS_ENDPOINT', '');
    // Host used to build client-facing URLs. The internal endpoint is fine for
    // server↔store calls, but a device/emulator cannot reach the server's
    // "localhost"; defaults to the internal endpoint when unset.
    this.publicEndpoint =
      this.configService.get<string>('S3_PUBLIC_ENDPOINT', '') || this.endpoint;
    this.isLocalStack = !!this.endpoint;

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: this.region,
    };

    if (this.isLocalStack) {
      clientConfig.endpoint = this.endpoint;
      clientConfig.credentials = {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', 'test'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
          'test',
        ),
      };
      clientConfig.forcePathStyle = true; // Required for LocalStack
    }

    this.s3Client = new S3Client(clientConfig);

    this.logger.log(
      `S3 Storage Provider initialized - ${this.isLocalStack ? 'LocalStack' : 'AWS'} mode (bucket: ${this.defaultBucket})`,
    );
  }

  async uploadFile(params: PutFileParams): Promise<StorageWriteResult> {
    const bucket = params.bucket || this.defaultBucket;
    const { key, body, contentType, metadata } = params;

    try {
      const response = await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: metadata,
        }),
      );

      return {
        key,
        url: this.getPublicUrl(key, bucket),
        etag: response.ETag,
      };
    } catch (error) {
      throw this.normalize(error, `Failed to upload "${key}"`);
    }
  }

  async downloadFile(key: string, bucket?: string): Promise<DownloadedFile> {
    const targetBucket = bucket || this.defaultBucket;

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: targetBucket, Key: key }),
      );

      const bytes = await response.Body?.transformToByteArray();
      return {
        body: Buffer.from(bytes ?? new Uint8Array()),
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error) {
      throw this.normalize(error, `Failed to download "${key}"`, key);
    }
  }

  async deleteFile(key: string, bucket?: string): Promise<void> {
    const targetBucket = bucket || this.defaultBucket;

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: targetBucket, Key: key }),
      );
    } catch (error) {
      throw this.normalize(error, `Failed to delete "${key}"`);
    }
  }

  async generateDownloadUrl(params: SignedDownloadParams): Promise<string> {
    const bucket = params.bucket || this.defaultBucket;
    const { key, expiresIn = DEFAULT_EXPIRES_IN } = params;

    try {
      return await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn },
      );
    } catch (error) {
      throw this.normalize(error, `Failed to sign download URL for "${key}"`);
    }
  }

  async generateUploadUrl(params: SignedUploadParams): Promise<string> {
    const bucket = params.bucket || this.defaultBucket;
    const { key, contentType, expiresIn = DEFAULT_EXPIRES_IN } = params;

    try {
      return await getSignedUrl(
        this.s3Client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn },
      );
    } catch (error) {
      throw this.normalize(error, `Failed to sign upload URL for "${key}"`);
    }
  }

  async getObjectMetadata(
    key: string,
    bucket?: string,
  ): Promise<StorageObjectMetadata> {
    const targetBucket = bucket || this.defaultBucket;

    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: targetBucket, Key: key }),
      );
      return {
        key,
        size: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      throw this.normalize(error, `Failed to read metadata for "${key}"`, key);
    }
  }

  async fileExists(key: string, bucket?: string): Promise<boolean> {
    const targetBucket = bucket || this.defaultBucket;

    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: targetBucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (this.isNotFound(error)) {
        return false;
      }
      throw this.normalize(error, `Failed to check existence of "${key}"`);
    }
  }

  getPublicUrl(key: string, bucket?: string): string {
    const targetBucket = bucket || this.defaultBucket;

    if (this.isLocalStack) {
      // LocalStack uses path-style URLs against the client-reachable endpoint.
      return `${this.publicEndpoint}/${targetBucket}/${key}`;
    }

    // Real AWS S3 virtual-hosted-style URL.
    return `https://${targetBucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  // ---- error normalization -------------------------------------------------

  private isNotFound(error: unknown): boolean {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return (
      e?.name === 'NotFound' ||
      e?.name === 'NoSuchKey' ||
      e?.$metadata?.httpStatusCode === 404
    );
  }

  /** Map any SDK error to a normalized application exception. */
  private normalize(
    error: unknown,
    message: string,
    key?: string,
  ): StorageException | StorageObjectNotFoundException {
    if (this.isNotFound(error)) {
      return new StorageObjectNotFoundException(key);
    }
    this.logger.error(message, error as Error);
    return new StorageException(message, error);
  }
}

import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3StorageProvider } from './providers/s3-storage.provider';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from './interfaces/storage-provider.interface';
import { StorageService } from './storage.service';

/**
 * Selects the storage backend from the STORAGE_PROVIDER env var. Adding a new
 * backend (e.g. a CloudFront-aware provider) means implementing StorageProvider
 * and adding a case here — no business module changes.
 */
function storageProviderFactory(config: ConfigService): StorageProvider {
  const provider = config.get<string>('STORAGE_PROVIDER', 's3').toLowerCase();

  switch (provider) {
    case 's3':
      return new S3StorageProvider(config);
    // case 'cloudfront': return new CloudFrontStorageProvider(config); // future
    default:
      new Logger('StorageModule').warn(
        `Unknown STORAGE_PROVIDER "${provider}", falling back to "s3".`,
      );
      return new S3StorageProvider(config);
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: storageProviderFactory,
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [STORAGE_PROVIDER, StorageService],
})
export class StorageModule {}

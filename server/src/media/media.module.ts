import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StoredFileService } from './stored-file.service';

/**
 * The media layer. Exposes the unified StoredFileService used by every business
 * module that owns files. Global so any module can depend on it (like
 * StorageModule) without repeated imports.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [StoredFileService],
  exports: [StoredFileService],
})
export class MediaModule {}

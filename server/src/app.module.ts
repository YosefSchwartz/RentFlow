import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { MediaModule } from './media/media.module';
import { OtpModule } from './otp/otp.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { DocumentsModule } from './documents/documents.module';
import { FoldersModule } from './folders/folders.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { AiModule } from './ai/ai.module';
import { PropertyMediaModule } from './property-media/property-media.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { LeasesModule } from './leases/leases.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // `.env.local` (gitignored) overrides `.env` for machine-specific values.
      // In production, real environment variables take precedence over both.
      envFilePath: ['.env.local', '.env'],
    }),
    HealthModule,
    PrismaModule,
    StorageModule,
    MediaModule,
    OtpModule,
    EmailModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    DocumentsModule,
    FoldersModule,
    ReceiptsModule,
    AiModule,
    PropertyMediaModule,
    MaintenanceModule,
    LeasesModule,
    NotificationsModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { MediaModule } from './media/media.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { DocumentsModule } from './documents/documents.module';
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
    PrismaModule,
    StorageModule,
    MediaModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    DocumentsModule,
    PropertyMediaModule,
    MaintenanceModule,
    LeasesModule,
    NotificationsModule,
  ],
})
export class AppModule {}

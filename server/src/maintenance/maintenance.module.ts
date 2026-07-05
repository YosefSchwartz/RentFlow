import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceAttachmentsService } from './maintenance-attachments.service';
import { PropertiesModule } from '../properties/properties.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PropertiesModule, NotificationsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceAttachmentsService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}

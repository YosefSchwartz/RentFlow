import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PropertiesModule } from '../properties/properties.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PropertiesModule, NotificationsModule, ReceiptsModule, AiModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

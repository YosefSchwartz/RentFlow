import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { PropertiesModule } from '../properties/properties.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PropertiesModule, AiModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}

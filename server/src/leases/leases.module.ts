import { Module } from '@nestjs/common';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { LeasePricingService } from './lease-pricing.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [LeasesController],
  providers: [LeasesService, LeasePricingService],
  exports: [LeasesService, LeasePricingService],
})
export class LeasesModule {}

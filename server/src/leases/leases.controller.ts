import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { LeasesService } from './leases.service';
import { LeasePricingService } from './lease-pricing.service';
import {
  CreateLeaseDto,
  UpdateLeaseStatusDto,
  RedeemLeaseDto,
  UpdateLeaseTermsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class LeasesController {
  constructor(
    private readonly leasesService: LeasesService,
    private readonly pricingService: LeasePricingService,
  ) {}

  @Get('leases/my')
  findMyLeases(@CurrentUser('id') userId: string) {
    return this.leasesService.findMyLeases(userId);
  }

  // Tenant redeems a lease activation code to connect to the lease.
  @Post('leases/redeem')
  redeem(@Body() dto: RedeemLeaseDto, @CurrentUser('id') userId: string) {
    return this.leasesService.redeem(dto.code, userId);
  }

  // Owner regenerates the activation code for an unassigned lease.
  @Post('leases/:id/activation-code')
  regenerateCode(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.leasesService.regenerateCode(id, userId);
  }

  @Get('leases/:id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.leasesService.findOne(id, userId);
  }

  // The lease's pricing schedule, sorted by start date (owner or tenant).
  @Get('leases/:id/terms')
  getTerms(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.pricingService.getLeaseTerms(id, userId);
  }

  // Owner replaces the lease's entire pricing schedule.
  @Put('leases/:id/terms')
  updateTerms(
    @Param('id') id: string,
    @Body() dto: UpdateLeaseTermsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.leasesService.updateTerms(id, dto, userId);
  }

  @Get('properties/:propertyId/leases')
  findAllForProperty(
    @Param('propertyId') propertyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leasesService.findAllForProperty(propertyId, userId);
  }

  @Post('properties/:propertyId/leases')
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateLeaseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.leasesService.create(propertyId, dto, userId);
  }

  @Patch('leases/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeaseStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.leasesService.updateStatus(id, dto.status, userId);
  }
}

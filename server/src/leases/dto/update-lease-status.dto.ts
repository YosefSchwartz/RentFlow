import { IsEnum } from 'class-validator';
import { LeaseStatus } from '@prisma/client';

export class UpdateLeaseStatusDto {
  @IsEnum(LeaseStatus)
  status: LeaseStatus;
}

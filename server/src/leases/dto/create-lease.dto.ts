import {
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeaseTermInputDto } from './lease-term.dto';

// A landlord-owned lease. No tenant is required at creation — the tenant is
// connected later by redeeming the lease's activation code.
export class CreateLeaseDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  // LEGACY single-rent input, kept for backward compatibility. When present
  // (and leaseTerms is not), it becomes a single pricing period covering the
  // entire lease.
  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyRent?: number;

  // The lease's pricing schedule. Takes precedence over monthlyRent.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeaseTermInputDto)
  @IsOptional()
  leaseTerms?: LeaseTermInputDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  depositAmount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

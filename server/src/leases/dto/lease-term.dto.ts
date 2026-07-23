import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// One pricing period of a lease's rent schedule. Schedule-level rules
// (no overlaps, no gaps, full coverage of the lease duration, unique
// displayOrder) are enforced by LeasePricingService.
export class LeaseTermInputDto {
  @IsDateString()
  startDate: string;

  // Omitted only on the last term of an open-ended lease.
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @Min(0)
  monthlyRent: number;

  // ISO 4217 code; defaults to ILS when omitted.
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be an ISO 4217 code' })
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  // Optional: assigned from the chronological position when omitted.
  @IsInt()
  @Min(1)
  @IsOptional()
  displayOrder?: number;
}

/** Replaces a lease's entire pricing schedule (owner only). */
export class UpdateLeaseTermsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeaseTermInputDto)
  leaseTerms: LeaseTermInputDto[];
}

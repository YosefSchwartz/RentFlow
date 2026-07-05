import {
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

// A landlord-owned lease. No tenant is required at creation — the tenant is
// connected later by redeeming the lease's activation code.
export class CreateLeaseDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyRent?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  depositAmount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

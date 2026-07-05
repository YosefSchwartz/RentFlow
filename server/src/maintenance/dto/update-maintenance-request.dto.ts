import {
  IsString,
  IsInt,
  IsEnum,
  IsOptional,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { MaintenanceStatus } from '@prisma/client';

export class UpdateMaintenanceRequestDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsEnum(MaintenanceStatus)
  @IsOptional()
  status?: MaintenanceStatus;
}

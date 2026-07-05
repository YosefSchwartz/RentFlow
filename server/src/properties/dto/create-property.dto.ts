import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateNested,
  IsNotEmpty,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// Nested DTO for structured address from Google Places
export class AddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  formattedAddress: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  street?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  streetNumber?: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  @IsNotEmpty()
  placeId: string;
}

export class CreatePropertyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  // Structured address from Google Places
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  location: AddressDto;

  @IsInt()
  @Min(1)
  @Max(10000)
  squareMeters: number;

  @IsInt()
  @Min(1)
  @Max(50)
  rooms: number;

  @IsInt()
  @IsOptional()
  @Min(-5)
  @Max(200)
  floor?: number;

  @IsBoolean()
  @IsOptional()
  hasBalcony?: boolean;

  @IsBoolean()
  @IsOptional()
  hasParking?: boolean;

  @IsBoolean()
  @IsOptional()
  hasStorage?: boolean;

  @IsBoolean()
  @IsOptional()
  hasShelter?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

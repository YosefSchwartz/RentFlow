import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { DocumentCategory, DocumentVisibility } from '@prisma/client';

/**
 * DTO for requesting a signed upload URL
 */
export class GetUploadUrlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  filename: string;

  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  mimeType: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  fileSize?: number;

  @IsEnum(DocumentVisibility)
  @IsOptional()
  visibility?: DocumentVisibility;
}

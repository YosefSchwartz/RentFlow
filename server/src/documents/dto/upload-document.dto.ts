import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { DocumentCategory, DocumentPermission } from '@prisma/client';

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

  @IsEnum(DocumentPermission)
  @IsOptional()
  permission?: DocumentPermission;

  /** Optional folder to file the document into (property root when omitted). */
  @IsString()
  @IsOptional()
  folderId?: string;
}

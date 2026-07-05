import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { DocumentCategory, DocumentVisibility } from '@prisma/client';

/** Editable business fields of a document (storage is never edited here). */
export class UpdateDocumentDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsEnum(DocumentCategory)
  @IsOptional()
  category?: DocumentCategory;

  @IsEnum(DocumentVisibility)
  @IsOptional()
  visibility?: DocumentVisibility;
}

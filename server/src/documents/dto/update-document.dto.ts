import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DocumentCategory, DocumentPermission } from '@prisma/client';

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

  @IsEnum(DocumentPermission)
  @IsOptional()
  permission?: DocumentPermission;

  /**
   * Move the document into a folder. `null` moves it to the property root;
   * omit to leave it where it is.
   */
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsOptional()
  folderId?: string | null;
}

import {
  IsString,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { DocumentCategory } from '@prisma/client';

/**
 * DTO for a landlord requesting a document from a tenant (required-documents
 * workflow). No file is attached yet — the tenant uploads it later.
 */
export class RequestDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsEnum(DocumentCategory)
  category: DocumentCategory;
}

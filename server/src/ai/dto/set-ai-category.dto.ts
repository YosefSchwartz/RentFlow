import { IsEnum } from 'class-validator';
import { DocumentCategory } from '@prisma/client';

/**
 * The user's category decision from the AI screen. This becomes the official
 * `Document.category`; the AI prediction is retained separately for analytics.
 */
export class SetAiCategoryDto {
  @IsEnum(DocumentCategory)
  category: DocumentCategory;
}

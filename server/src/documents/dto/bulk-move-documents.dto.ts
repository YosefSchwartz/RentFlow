import {
  IsArray,
  IsString,
  IsOptional,
  ArrayNotEmpty,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';

export class BulkMoveDocumentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];

  /** Target folder id, or `null` to move the documents to the property root. */
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsOptional()
  folderId?: string | null;
}

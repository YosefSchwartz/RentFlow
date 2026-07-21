import { IsArray, IsString, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';

export class BulkDeleteDocumentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];
}

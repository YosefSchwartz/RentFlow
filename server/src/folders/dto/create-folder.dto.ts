import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /** Parent folder id for nesting. Omit/null to create at the property root. */
  @IsString()
  @IsOptional()
  parentId?: string;
}

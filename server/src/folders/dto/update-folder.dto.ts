import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateFolderDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  /**
   * New parent folder id (re-parenting). `null` moves the folder to the
   * property root. Omit to leave the parent unchanged.
   */
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

import { IsString, MinLength } from 'class-validator';

/** Re-authentication payload required to permanently delete an account. */
export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password: string;
}

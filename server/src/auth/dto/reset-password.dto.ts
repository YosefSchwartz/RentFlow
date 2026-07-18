import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { IsPasswordPolicyCompliant } from '../validators/password-policy';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @IsPasswordPolicyCompliant()
  @MaxLength(50)
  newPassword: string;
}

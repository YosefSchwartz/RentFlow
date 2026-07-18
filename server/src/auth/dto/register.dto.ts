import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { IsPasswordPolicyCompliant } from '../validators/password-policy';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsPasswordPolicyCompliant()
  @MaxLength(50)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;

  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone: string;
}

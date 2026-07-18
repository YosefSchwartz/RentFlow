import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OtpService } from './otp.service';

/**
 * OTP issuance/verification for email verification, password reset, and (in
 * the future) email change — see OtpPurpose. Global so any module can depend
 * on it without repeated imports, mirroring MediaModule/StorageModule.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}

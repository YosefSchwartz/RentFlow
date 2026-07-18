import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PROVIDER, EmailProvider } from './interfaces/email-provider.interface';
import { buildPasswordResetEmail, buildVerificationEmail } from './templates/otp-email.template';

/**
 * Reusable, business-facing email API. Callers never touch EmailProvider
 * directly — this is the one place new email types (verification, password
 * reset, and future notification emails) get added.
 */
@Injectable()
export class EmailService {
  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}

  async sendVerificationOtp(to: string, firstName: string, code: string): Promise<void> {
    const { subject, html, text } = buildVerificationEmail(firstName, code);
    await this.provider.send({ to, subject, html, text });
  }

  async sendPasswordResetOtp(to: string, firstName: string, code: string): Promise<void> {
    const { subject, html, text } = buildPasswordResetEmail(firstName, code);
    await this.provider.send({ to, subject, html, text });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, SendEmailParams } from '../interfaces/email-provider.interface';

/**
 * Local/dev fallback — logs the email instead of sending it. Lets the whole
 * OTP flow be built and tested with zero AWS dependency. Selected when
 * EMAIL_PROVIDER is unset or "console".
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('ConsoleEmailProvider');

  async send(params: SendEmailParams): Promise<void> {
    this.logger.log(
      `[email:console] to=${params.to} subject="${params.subject}"\n${params.text}`,
    );
  }
}

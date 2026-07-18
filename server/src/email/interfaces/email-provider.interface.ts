/**
 * Email transport abstraction, mirroring StorageProvider — no SDK type ever
 * crosses this boundary. Business code depends solely on EmailService.
 */

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<void>;
}

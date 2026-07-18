import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailProvider, SendEmailParams } from '../interfaces/email-provider.interface';

/**
 * Amazon SES implementation of EmailProvider. The only class in the backend
 * that imports the SES SDK, mirroring S3StorageProvider's isolation of the S3
 * SDK. Sends from a single verified email identity (SES_SENDER_EMAIL) — see
 * infrastructure/terraform/modules/notifications.
 */
@Injectable()
export class SesEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SesEmailProvider.name);
  private readonly client: SESClient;
  private readonly senderEmail: string;

  constructor(configService: ConfigService) {
    const region = configService.get<string>('AWS_REGION', 'eu-central-1');
    this.senderEmail = configService.get<string>('SES_SENDER_EMAIL', '');
    this.client = new SESClient({ region });
  }

  async send(params: SendEmailParams): Promise<void> {
    if (!this.senderEmail) {
      throw new Error('SES_SENDER_EMAIL is not configured');
    }

    await this.client.send(
      new SendEmailCommand({
        Source: this.senderEmail,
        Destination: { ToAddresses: [params.to] },
        Message: {
          Subject: { Data: params.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: params.html, Charset: 'UTF-8' },
            Text: { Data: params.text, Charset: 'UTF-8' },
          },
        },
      }),
    );

    this.logger.log(`Sent email via SES to=${params.to} subject="${params.subject}"`);
  }
}

import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { SesEmailProvider } from './providers/ses-email.provider';
import { EMAIL_PROVIDER, EmailProvider } from './interfaces/email-provider.interface';
import { EmailService } from './email.service';

/**
 * Selects the email backend from the EMAIL_PROVIDER env var, mirroring
 * StorageModule's storageProviderFactory. Adding a new backend means
 * implementing EmailProvider and adding a case here — no business module
 * changes.
 */
function emailProviderFactory(config: ConfigService): EmailProvider {
  const provider = config.get<string>('EMAIL_PROVIDER', 'console').toLowerCase();

  switch (provider) {
    case 'ses':
      return new SesEmailProvider(config);
    case 'console':
      return new ConsoleEmailProvider();
    default:
      new Logger('EmailModule').warn(
        `Unknown EMAIL_PROVIDER "${provider}", falling back to "console".`,
      );
      return new ConsoleEmailProvider();
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: emailProviderFactory,
      inject: [ConfigService],
    },
    EmailService,
  ],
  exports: [EMAIL_PROVIDER, EmailService],
})
export class EmailModule {}

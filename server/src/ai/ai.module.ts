import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PropertiesModule } from '../properties/properties.module';
import { AI_PROVIDER, AIProvider } from './interfaces/ai-provider.interface';
import { MockProvider } from './providers/mock.provider';
import { BedrockProvider } from './providers/bedrock.provider';

/**
 * Selects the AI backend from the AI_PROVIDER env var — mirrors
 * storageProviderFactory. Adding a provider (OpenAI, Anthropic, Gemini) means
 * implementing AIProvider and adding a case here; business services are
 * untouched. Defaults to the dependency-free MockProvider so dev/local/tests
 * work with zero AWS configuration.
 */
function aiProviderFactory(config: ConfigService): AIProvider {
  const provider = config.get<string>('AI_PROVIDER', 'mock').toLowerCase();

  switch (provider) {
    case 'bedrock':
      return new BedrockProvider(
        // Cheap, active, Anthropic-format model available in eu-central-1 via a
        // cross-region inference profile. Override with AI_MODEL_ID.
        config.get<string>('AI_MODEL_ID', 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'),
        config.get<string>('AI_AWS_REGION') ||
          config.get<string>('AWS_REGION', 'eu-central-1'),
      );
    case 'mock':
      return new MockProvider();
    default:
      new Logger('AiModule').warn(
        `Unknown AI_PROVIDER "${provider}", falling back to "mock".`,
      );
      return new MockProvider();
  }
}

@Module({
  imports: [ConfigModule, PropertiesModule],
  controllers: [AiController],
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: aiProviderFactory,
      inject: [ConfigService],
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}

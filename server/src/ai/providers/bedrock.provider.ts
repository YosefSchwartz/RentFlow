import { Logger } from '@nestjs/common';
import { DocumentCategory } from '@prisma/client';
import {
  AIProvider,
  AiAnalysisRequest,
  AiAnalysisResult,
  AiExtractedFieldResult,
} from '../interfaces/ai-provider.interface';

const ALLOWED_CATEGORIES = Object.values(DocumentCategory);

/**
 * AWS Bedrock provider (first real provider). Uses InvokeModel with the
 * Anthropic-on-Bedrock messages format. Authenticates via the ECS task role
 * (no static credentials). The SDK is lazy-loaded so it is only pulled in when
 * AI_PROVIDER=bedrock.
 *
 * NOTE: this is provider plumbing, not business logic — the prompt asks for a
 * generic {summary, category, confidence, fields} JSON contract. Domain-specific
 * prompting/parsing is intentionally out of scope for this PR.
 */
export class BedrockProvider implements AIProvider {
  private readonly logger = new Logger(BedrockProvider.name);
  readonly name = 'bedrock';
  readonly model: string;
  private readonly region: string;
  // Typed loosely to avoid a hard top-level dependency on the SDK types.
  private client: any;

  constructor(model: string, region: string) {
    this.model = model;
    this.region = region;
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      const { BedrockRuntimeClient } = await import(
        '@aws-sdk/client-bedrock-runtime'
      );
      this.client = new BedrockRuntimeClient({ region: this.region });
    }
    return this.client;
  }

  async analyzeDocument(
    request: AiAnalysisRequest,
  ): Promise<AiAnalysisResult> {
    const { InvokeModelCommand } = await import(
      '@aws-sdk/client-bedrock-runtime'
    );
    const client = await this.getClient();

    const prompt = this.buildPrompt(request);
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    });

    const response = await client.send(
      new InvokeModelCommand({
        modelId: this.model,
        contentType: 'application/json',
        accept: 'application/json',
        body,
      }),
    );

    const decoded = JSON.parse(new TextDecoder().decode(response.body));
    // Anthropic-on-Bedrock returns { content: [{ type: 'text', text }] }.
    const text: string = decoded?.content?.[0]?.text ?? '';
    return this.parse(text, request);
  }

  private buildPrompt(request: AiAnalysisRequest): string {
    return [
      'You analyze a document and respond with ONLY a JSON object, no prose.',
      'Shape:',
      '{ "summary": string, "category": string, "confidence": number (0..1), "fields": [ { "key": string, "value": string } ] }',
      `Allowed category values: ${ALLOWED_CATEGORIES.join(', ')}.`,
      `Document file name: ${request.fileName}`,
      request.text ? `Document text:\n${request.text}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private parse(
    text: string,
    request: AiAnalysisRequest,
  ): AiAnalysisResult {
    let parsed: any;
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch (err) {
      this.logger.error(
        `Bedrock returned unparseable output for ${request.documentId}`,
      );
      throw new Error('AI provider returned an unparseable response');
    }

    const category: DocumentCategory = ALLOWED_CATEGORIES.includes(
      parsed.category,
    )
      ? parsed.category
      : DocumentCategory.OTHER;

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

    const fields: AiExtractedFieldResult[] = Array.isArray(parsed.fields)
      ? parsed.fields
          .filter((f: any) => f && f.key)
          .map((f: any) => ({ key: String(f.key), valueText: f.value != null ? String(f.value) : null }))
      : [];

    return {
      summary: String(parsed.summary ?? ''),
      classification: { category, confidence },
      fields,
      provider: this.name,
      model: this.model,
    };
  }
}

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

    // Multimodal: attach the document itself when we have readable bytes, so
    // the model analyzes real content (not just the file name). Images use an
    // `image` block; PDFs use a `document` block. Falls back to text-only.
    const content: any[] = [];
    if (request.fileBase64 && request.mimeType) {
      if (request.mimeType === 'application/pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: request.fileBase64 },
        });
      } else if (request.mimeType.startsWith('image/')) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: request.mimeType, data: request.fileBase64 },
        });
      }
    }
    content.push({ type: 'text', text: prompt });

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
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
    const hasFile = !!request.fileBase64;
    const lang = request.outputLanguage || 'English';
    return [
      'You are a document-analysis assistant for a property-management app.',
      'Documents may be in any language (e.g. Hebrew); read them regardless.',
      hasFile
        ? 'Analyze the attached document.'
        : 'No document content is available — infer only from the file name.',
      `Write the "summary" and any human-readable field values in ${lang}, regardless of the document's own language. Keep field "key" names in English (e.g. supplier, amount).`,
      'Respond with ONLY a JSON object (no prose, no markdown fences).',
      'Shape: { "summary": string (one concise sentence), "category": string, "confidence": number 0..1, "fields": [ { "key": string, "value": string } ] }',
      `"category" must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`,
      'Determine the category, then extract the fields relevant to it:',
      '- RECEIPT / INVOICE: supplier, invoiceNumber, invoiceDate, amount, vat, currency',
      '- LEASE_AGREEMENT / SIGNED_LEASE: tenant, landlord, rent, deposit, leaseStart, leaseEnd',
      '- INSURANCE: company, policyNumber, expirationDate',
      '- otherwise: a few key facts as fields.',
      'Use ISO dates (YYYY-MM-DD) and plain numbers (no currency symbols or thousands separators). Omit any field you cannot find — never invent values.',
      `File name: ${request.fileName}`,
      request.text ? `Extracted text:\n${request.text}` : '',
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
          .map((f: any) => this.toField(f))
      : [];

    return {
      summary: String(parsed.summary ?? ''),
      classification: { category, confidence },
      fields,
      provider: this.name,
      model: this.model,
    };
  }

  /**
   * Map a model field to a normalized AiExtractedField. Keeps the raw string in
   * valueText and additionally populates valueNumber / valueDate when the value
   * is clearly numeric or an ISO date — makes the metadata search-ready.
   */
  private toField(f: any): AiExtractedFieldResult {
    const key = String(f.key);
    const raw = f.value != null ? String(f.value) : null;
    let valueNumber: number | null = null;
    let valueDate: string | null = null;
    if (raw) {
      const numeric = raw.replace(/[\s,]/g, '');
      if (/^-?\d+(\.\d+)?$/.test(numeric)) valueNumber = Number(numeric);
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) valueDate = raw.trim();
    }
    return { key, valueText: raw, valueNumber, valueDate };
  }
}

import { DocumentCategory } from '@prisma/client';

/** DI token for the active AIProvider implementation. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

/**
 * Input for an analysis request. Today only lightweight text/metadata is sent
 * (no OCR). `fileUrl`/`text` are the seams for future OCR / Vision / text
 * extraction — providers opt in without business services changing.
 */
export interface AiAnalysisRequest {
  documentId: string;
  fileName: string;
  mimeType?: string | null;
  /** Pre-extracted text, when available (future OCR/text-extraction output). */
  text?: string | null;
  /** Signed URL to the file, for providers that fetch/OCR it (future). */
  fileUrl?: string | null;
  /**
   * Base64-encoded file bytes for multimodal (vision / PDF) analysis. Set only
   * for supported types within the size limit (see AiService); null otherwise,
   * in which case a provider falls back to filename-only analysis.
   */
  fileBase64?: string | null;
  /**
   * Human language the summary (and human-readable field values) should be
   * written in — the app's UI language, e.g. "English" or "Hebrew". The model
   * reads documents in any language regardless; this controls the OUTPUT.
   */
  outputLanguage?: string | null;
}

export interface AiClassificationResult {
  category: DocumentCategory;
  /** 0..1 */
  confidence: number;
}

/** A single normalized extracted field (maps to one AiExtractedField row). */
export interface AiExtractedFieldResult {
  key: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null; // ISO date
  confidence?: number | null;
}

export interface AiAnalysisResult {
  summary: string;
  classification: AiClassificationResult;
  fields: AiExtractedFieldResult[];
  provider: string;
  model: string;
}

/**
 * The single abstraction every business service depends on. Concrete providers
 * (Bedrock, Mock, and future OpenAI/Anthropic/Gemini) implement it. Business
 * logic MUST NOT reference any concrete provider.
 *
 * Future capabilities (OCR, Vision, plain text extraction, structured
 * extraction) are added as OPTIONAL methods here so existing callers are never
 * forced to change:
 *
 *   ocr?(req): Promise<{ text: string }>
 *   extractText?(req): Promise<{ text: string }>
 *   vision?(req): Promise<...>
 *   extractStructured?(req, schema): Promise<...>
 */
export interface AIProvider {
  /** Stable provider name persisted on jobs/results (e.g. "bedrock", "mock"). */
  readonly name: string;
  /** Model identifier persisted on jobs/results. */
  readonly model: string;
  /** Analyze a document: summary + category suggestion + extracted fields. */
  analyzeDocument(request: AiAnalysisRequest): Promise<AiAnalysisResult>;
}

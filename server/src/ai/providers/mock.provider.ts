import { DocumentCategory } from '@prisma/client';
import {
  AIProvider,
  AiAnalysisRequest,
  AiAnalysisResult,
} from '../interfaces/ai-provider.interface';

/**
 * Deterministic, dependency-free provider used in development/local/tests and
 * as the safe default. It never calls an external service — it derives a
 * plausible analysis from the file name so the whole async pipeline can be
 * exercised end-to-end without AWS. Contains NO business-specific AI logic.
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'mock-v1';

  async analyzeDocument(
    request: AiAnalysisRequest,
  ): Promise<AiAnalysisResult> {
    const lower = request.fileName.toLowerCase();

    // Coarse keyword guess — purely illustrative, not real classification.
    let category: DocumentCategory = DocumentCategory.OTHER;
    if (/receipt|invoice|faktura/.test(lower)) category = DocumentCategory.RECEIPT;
    else if (/insur/.test(lower)) category = DocumentCategory.INSURANCE;
    else if (/lease|contract|שכיר/.test(lower)) category = DocumentCategory.LEASE_AGREEMENT;
    else if (/plan/.test(lower)) category = DocumentCategory.PROPERTY_PLAN;

    return {
      summary: `Mock analysis of "${request.fileName}". Replace MockProvider with a real AIProvider to get genuine results.`,
      classification: { category, confidence: 0.87 },
      fields: [
        { key: 'detectedType', valueText: category, confidence: 0.87 },
        { key: 'fileName', valueText: request.fileName },
      ],
      provider: this.name,
      model: this.model,
    };
  }
}

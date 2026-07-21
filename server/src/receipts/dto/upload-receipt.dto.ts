import {
  IsString,
  IsOptional,
  IsISO8601,
  MinLength,
  MaxLength,
} from 'class-validator';

/**
 * Metadata accompanying a manual receipt upload. The file itself comes as the
 * multipart `file` part; these fields are optional context.
 */
export class UploadReceiptDto {
  /** Display name; defaults to the uploaded file's original name when omitted. */
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  /** ISO date the receipt was issued. Drives the tax year (else upload date). */
  @IsISO8601()
  @IsOptional()
  receiptDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  /** Optional lease this expense relates to. */
  @IsString()
  @IsOptional()
  relatedLeaseId?: string;
}

-- AI Document Intelligence Platform (PR3)
--
-- Hand-written migration (shadow-DB/`migrate dev` is broken for this project),
-- applied with `prisma db execute` + `prisma migrate resolve --applied`.
-- Additive only — new enum values + new tables. No existing column/table is
-- altered, so it is fully backwards compatible.

-- 1. New enum values on DocumentAuditAction. (Idempotent guards so re-runs are
--    safe; ADD VALUE cannot run inside a transaction, which db execute honors.)
ALTER TYPE "DocumentAuditAction" ADD VALUE IF NOT EXISTS 'AI_REQUESTED';
ALTER TYPE "DocumentAuditAction" ADD VALUE IF NOT EXISTS 'AI_COMPLETED';
ALTER TYPE "DocumentAuditAction" ADD VALUE IF NOT EXISTS 'AI_FAILED';
ALTER TYPE "DocumentAuditAction" ADD VALUE IF NOT EXISTS 'AI_SUGGESTION_ACCEPTED';
ALTER TYPE "DocumentAuditAction" ADD VALUE IF NOT EXISTS 'AI_CATEGORY_CHANGED';
ALTER TYPE "DocumentAuditAction" ADD VALUE IF NOT EXISTS 'AI_RETRIED';

-- 2. AI job status enum.
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- 3. AiJob.
CREATE TABLE "AiJob" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "documentId" TEXT NOT NULL,
  CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiJob_documentId_idx" ON "AiJob"("documentId");
CREATE INDEX "AiJob_status_idx" ON "AiJob"("status");
ALTER TABLE "AiJob"
  ADD CONSTRAINT "AiJob_documentId_fkey" FOREIGN KEY ("documentId")
  REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. AiSummary (1:1 with Document).
CREATE TABLE "AiSummary" (
  "id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "documentId" TEXT NOT NULL,
  CONSTRAINT "AiSummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiSummary_documentId_key" ON "AiSummary"("documentId");
ALTER TABLE "AiSummary"
  ADD CONSTRAINT "AiSummary_documentId_fkey" FOREIGN KEY ("documentId")
  REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. AiClassification (1:1 with Document). approved* are user-owned; AI writes
--    only predicted*/confidence.
CREATE TABLE "AiClassification" (
  "id" TEXT NOT NULL,
  "predictedCategory" "DocumentCategory" NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "approvedCategory" "DocumentCategory",
  "approvedAt" TIMESTAMP(3),
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "documentId" TEXT NOT NULL,
  "approvedById" TEXT,
  CONSTRAINT "AiClassification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiClassification_documentId_key" ON "AiClassification"("documentId");
CREATE INDEX "AiClassification_approvedById_idx" ON "AiClassification"("approvedById");
ALTER TABLE "AiClassification"
  ADD CONSTRAINT "AiClassification_documentId_fkey" FOREIGN KEY ("documentId")
  REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiClassification"
  ADD CONSTRAINT "AiClassification_approvedById_fkey" FOREIGN KEY ("approvedById")
  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. AiExtractedField (normalized metadata, one row per field).
CREATE TABLE "AiExtractedField" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "valueText" TEXT,
  "valueNumber" DECIMAL(14,2),
  "valueDate" TIMESTAMP(3),
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "documentId" TEXT NOT NULL,
  CONSTRAINT "AiExtractedField_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiExtractedField_documentId_idx" ON "AiExtractedField"("documentId");
CREATE INDEX "AiExtractedField_key_idx" ON "AiExtractedField"("key");
ALTER TABLE "AiExtractedField"
  ADD CONSTRAINT "AiExtractedField_documentId_fkey" FOREIGN KEY ("documentId")
  REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

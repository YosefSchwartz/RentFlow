-- Receipt Center (PR2)
--
-- Hand-written migration (shadow-DB/`migrate dev` is broken for this project),
-- applied with `prisma db execute` + `prisma migrate resolve --applied`.
-- Additive only — no existing column/table is altered, so it is fully
-- backwards compatible and safe to run against a populated dev DB / remote RDS.

-- 1. Receipt source enum.
CREATE TYPE "ReceiptSource" AS ENUM ('MAINTENANCE', 'MANUAL_UPLOAD');

-- 2. Receipt metadata table (1:1 with a RECEIPT-category Document).
CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL,
  "receiptDate" TIMESTAMP(3),
  "taxYear" INTEGER NOT NULL,
  "source" "ReceiptSource" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "documentId" TEXT NOT NULL,
  "relatedMaintenanceId" TEXT,
  "relatedLeaseId" TEXT,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Receipt_documentId_key" ON "Receipt"("documentId");
CREATE INDEX "Receipt_taxYear_idx" ON "Receipt"("taxYear");
CREATE INDEX "Receipt_source_idx" ON "Receipt"("source");
CREATE INDEX "Receipt_relatedLeaseId_idx" ON "Receipt"("relatedLeaseId");
CREATE INDEX "Receipt_relatedMaintenanceId_idx" ON "Receipt"("relatedMaintenanceId");

ALTER TABLE "Receipt"
  ADD CONSTRAINT "Receipt_documentId_fkey" FOREIGN KEY ("documentId")
  REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receipt"
  ADD CONSTRAINT "Receipt_relatedMaintenanceId_fkey" FOREIGN KEY ("relatedMaintenanceId")
  REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receipt"
  ADD CONSTRAINT "Receipt_relatedLeaseId_fkey" FOREIGN KEY ("relatedLeaseId")
  REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

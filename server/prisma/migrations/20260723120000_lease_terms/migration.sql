-- Lease pricing periods (LeaseTerm)
--
-- Hand-written migration (shadow-DB/`migrate dev` is broken for this project),
-- applied with `prisma db execute` + `prisma migrate resolve --applied`.
-- Additive only — one new table, one new enum value, plus a data backfill.
-- No existing column/table is altered (Lease.monthlyRent is kept as a legacy
-- mirror of the first term), so it is fully backwards compatible.

-- 1. New notification type: tenant is informed when the landlord changes the
--    pricing schedule of their lease. (Idempotent guard so re-runs are safe;
--    ADD VALUE cannot run inside a transaction, which db execute honors.)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEASE_TERMS_UPDATED';

-- 2. LeaseTerm.
CREATE TABLE "LeaseTerm" (
  "id" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "monthlyRent" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ILS',
  "notes" TEXT,
  "displayOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "leaseId" TEXT NOT NULL,
  CONSTRAINT "LeaseTerm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaseTerm_leaseId_displayOrder_key" ON "LeaseTerm"("leaseId", "displayOrder");
CREATE INDEX "LeaseTerm_leaseId_idx" ON "LeaseTerm"("leaseId");
CREATE INDEX "LeaseTerm_leaseId_startDate_idx" ON "LeaseTerm"("leaseId", "startDate");

ALTER TABLE "LeaseTerm"
  ADD CONSTRAINT "LeaseTerm_leaseId_fkey" FOREIGN KEY ("leaseId")
  REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Data migration: every existing lease that has a monthly rent receives a
--    single term covering the entire lease duration (open-ended leases get an
--    open-ended term). Leases without a rent had no pricing before and stay
--    term-less. Idempotent via NOT EXISTS. IDs are random UUIDs (hex, "clt"
--    prefix) — only backfilled rows look like this; app-created rows use cuid.
INSERT INTO "LeaseTerm"
  ("id", "leaseId", "startDate", "endDate", "monthlyRent", "currency", "displayOrder", "createdAt", "updatedAt")
SELECT
  'clt' || replace(gen_random_uuid()::text, '-', ''),
  l."id",
  l."startDate",
  l."endDate",
  l."monthlyRent",
  'ILS',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Lease" l
WHERE l."monthlyRent" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "LeaseTerm" t WHERE t."leaseId" = l."id");

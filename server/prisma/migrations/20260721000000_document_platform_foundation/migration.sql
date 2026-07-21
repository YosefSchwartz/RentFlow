-- Document Platform Foundation (PR1)
--
-- Hand-written migration. The project's `migrate dev` / shadow-database flow is
-- broken, so this file is authored directly and applied with `migrate deploy`
-- (see migration notes in the PR). It is ordered so it runs cleanly against a
-- populated database (local dev and remote RDS): every data conversion happens
-- BEFORE the schema change that would otherwise reject the old values.

-- Needed for gen_random_uuid() when backfilling folder ids on RDS. No-op if the
-- extension already exists.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. DocumentCategory: drop PROPERTY_PHOTO, add PROPERTY_PLAN.
--    Reassign existing PROPERTY_PHOTO documents to OTHER first (no data loss),
--    then recreate the enum without that value (Postgres cannot drop an enum
--    value in place).
-- ---------------------------------------------------------------------------
UPDATE "Document" SET "category" = 'OTHER' WHERE "category" = 'PROPERTY_PHOTO';

ALTER TYPE "DocumentCategory" RENAME TO "DocumentCategory_old";

CREATE TYPE "DocumentCategory" AS ENUM (
  'INSURANCE',
  'WARRANTY',
  'METER_READING',
  'PROPERTY_PLAN',
  'INVOICE',
  'MANUAL',
  'LEASE_AGREEMENT',
  'SIGNED_LEASE',
  'GUARANTOR_DOCUMENT',
  'ADDENDUM',
  'IDENTIFICATION',
  'LEGAL',
  'PROPERTY_INFO',
  'TENANT_DOCUMENT',
  'RECEIPT',
  'CONTRACT',
  'OTHER'
);

ALTER TABLE "Document"
  ALTER COLUMN "category" TYPE "DocumentCategory"
  USING ("category"::text::"DocumentCategory");

DROP TYPE "DocumentCategory_old";

-- ---------------------------------------------------------------------------
-- 2. Permissions model replaces visibility.
--    Add the new column, convert ALL existing documents to LANDLORD_AND_TENANT,
--    then drop the old visibility column and its enum type.
-- ---------------------------------------------------------------------------
CREATE TYPE "DocumentPermission" AS ENUM ('LANDLORD_ONLY', 'LANDLORD_AND_TENANT');

ALTER TABLE "Document"
  ADD COLUMN "permission" "DocumentPermission" NOT NULL DEFAULT 'LANDLORD_ONLY';

UPDATE "Document" SET "permission" = 'LANDLORD_AND_TENANT';

ALTER TABLE "Document" DROP COLUMN "visibility";
DROP TYPE "DocumentVisibility";

-- ---------------------------------------------------------------------------
-- 3. New enums for folders and the audit log.
-- ---------------------------------------------------------------------------
CREATE TYPE "SystemFolderKey" AS ENUM (
  'CONTRACTS',
  'RECEIPTS',
  'PROPERTY_PLANS',
  'INSURANCE',
  'MUNICIPALITY',
  'GENERAL'
);

CREATE TYPE "DocumentAuditAction" AS ENUM (
  'UPLOAD',
  'DELETE',
  'RENAME',
  'MOVE',
  'PERMISSION_CHANGE',
  'PREVIEW',
  'DOWNLOAD'
);

-- ---------------------------------------------------------------------------
-- 4. Folder table.
-- ---------------------------------------------------------------------------
CREATE TABLE "Folder" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "systemKey" "SystemFolderKey",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "propertyId" TEXT NOT NULL,
  "parentId" TEXT,
  "createdById" TEXT,
  CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Folder_propertyId_idx" ON "Folder"("propertyId");
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_propertyId_fkey" FOREIGN KEY ("propertyId")
  REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId")
  REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_createdById_fkey" FOREIGN KEY ("createdById")
  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Document.folderId (nullable; existing documents stay at the root).
-- ---------------------------------------------------------------------------
ALTER TABLE "Document" ADD COLUMN "folderId" TEXT;
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId")
  REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. DocumentAuditLog table.
-- ---------------------------------------------------------------------------
CREATE TABLE "DocumentAuditLog" (
  "id" TEXT NOT NULL,
  "action" "DocumentAuditAction" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "documentId" TEXT,
  "propertyId" TEXT,
  "actorId" TEXT,
  CONSTRAINT "DocumentAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentAuditLog_documentId_idx" ON "DocumentAuditLog"("documentId");
CREATE INDEX "DocumentAuditLog_propertyId_idx" ON "DocumentAuditLog"("propertyId");
CREATE INDEX "DocumentAuditLog_actorId_idx" ON "DocumentAuditLog"("actorId");

ALTER TABLE "DocumentAuditLog"
  ADD CONSTRAINT "DocumentAuditLog_documentId_fkey" FOREIGN KEY ("documentId")
  REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentAuditLog"
  ADD CONSTRAINT "DocumentAuditLog_actorId_fkey" FOREIGN KEY ("actorId")
  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7. Backfill the six system folders for every EXISTING property, so old
--    properties are not empty. New properties get them from the service on
--    create. Uses the property owner as createdBy.
-- ---------------------------------------------------------------------------
INSERT INTO "Folder" ("id", "name", "isSystem", "systemKey", "propertyId", "createdById", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  v.name,
  true,
  v.key::"SystemFolderKey",
  p."id",
  p."ownerId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
CROSS JOIN (
  VALUES
    ('Contracts', 'CONTRACTS'),
    ('Receipts', 'RECEIPTS'),
    ('Property Plans', 'PROPERTY_PLANS'),
    ('Insurance', 'INSURANCE'),
    ('Municipality', 'MUNICIPALITY'),
    ('General', 'GENERAL')
) AS v(name, key);

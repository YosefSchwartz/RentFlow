-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('OPTIONAL', 'REQUESTED', 'RECEIVED');

-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'IDENTIFICATION';
ALTER TYPE "DocumentCategory" ADD VALUE 'LEGAL';
ALTER TYPE "DocumentCategory" ADD VALUE 'PROPERTY_INFO';
ALTER TYPE "DocumentCategory" ADD VALUE 'TENANT_DOCUMENT';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_REQUESTED';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'OPTIONAL',
ADD COLUMN     "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PRIVATE',
ALTER COLUMN "fileUrl" DROP NOT NULL;

-- Backfill: existing documents were visible to tenants before visibility
-- existed, so preserve that behavior by marking them SHARED. New documents
-- default to PRIVATE.
UPDATE "Document" SET "visibility" = 'SHARED';

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

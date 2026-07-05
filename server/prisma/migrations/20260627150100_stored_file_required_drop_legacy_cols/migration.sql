-- DropForeignKey
ALTER TABLE "MaintenanceAttachment" DROP CONSTRAINT "MaintenanceAttachment_storedFileId_fkey";

-- DropForeignKey
ALTER TABLE "PropertyMedia" DROP CONSTRAINT "PropertyMedia_storedFileId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "fileSize",
DROP COLUMN "fileUrl",
DROP COLUMN "mimeType";

-- AlterTable
ALTER TABLE "MaintenanceAttachment" DROP COLUMN "fileName",
DROP COLUMN "mimeType",
DROP COLUMN "size",
DROP COLUMN "url",
ALTER COLUMN "storedFileId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PropertyMedia" DROP COLUMN "fileName",
DROP COLUMN "mimeType",
DROP COLUMN "size",
DROP COLUMN "url",
ALTER COLUMN "storedFileId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAttachment" ADD CONSTRAINT "MaintenanceAttachment_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


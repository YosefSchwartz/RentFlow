-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'RECEIPT';

-- AlterEnum
ALTER TYPE "MediaType" ADD VALUE 'DOCUMENT';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "maintenanceRequestId" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceAttachment" ADD COLUMN     "commentId" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceComment" ALTER COLUMN "body" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Document_maintenanceRequestId_idx" ON "Document"("maintenanceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceAttachment_commentId_key" ON "MaintenanceAttachment"("commentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAttachment" ADD CONSTRAINT "MaintenanceAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "MaintenanceComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


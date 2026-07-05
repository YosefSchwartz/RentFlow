-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "storedFileId" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceAttachment" ADD COLUMN     "storedFileId" TEXT;

-- AlterTable
ALTER TABLE "PropertyMedia" ADD COLUMN     "storedFileId" TEXT;

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileExtension" TEXT,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "videoDuration" INTEGER,
    "storageProvider" TEXT NOT NULL DEFAULT 's3',
    "storageVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uploadedById" TEXT,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "StoredFile_uploadedById_idx" ON "StoredFile"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storedFileId_key" ON "Document"("storedFileId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceAttachment_storedFileId_key" ON "MaintenanceAttachment"("storedFileId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyMedia_storedFileId_key" ON "PropertyMedia"("storedFileId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAttachment" ADD CONSTRAINT "MaintenanceAttachment_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


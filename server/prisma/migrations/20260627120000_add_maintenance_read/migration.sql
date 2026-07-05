-- CreateTable
CREATE TABLE "MaintenanceRead" (
    "id" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MaintenanceRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceRead_userId_idx" ON "MaintenanceRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRead_requestId_userId_key" ON "MaintenanceRead"("requestId", "userId");

-- AddForeignKey
ALTER TABLE "MaintenanceRead" ADD CONSTRAINT "MaintenanceRead_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRead" ADD CONSTRAINT "MaintenanceRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


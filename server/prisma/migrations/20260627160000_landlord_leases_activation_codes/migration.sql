-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "Lease" DROP CONSTRAINT "Lease_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantAssignment" DROP CONSTRAINT "TenantAssignment_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "TenantAssignment" DROP CONSTRAINT "TenantAssignment_tenantId_fkey";

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "activationCode" TEXT,
ADD COLUMN     "activationCodeExpiresAt" TIMESTAMP(3),
ALTER COLUMN "tenantId" DROP NOT NULL;

-- DropTable
DROP TABLE "Invitation";

-- DropTable
DROP TABLE "TenantAssignment";

-- CreateIndex
CREATE UNIQUE INDEX "Lease_activationCode_key" ON "Lease"("activationCode");

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


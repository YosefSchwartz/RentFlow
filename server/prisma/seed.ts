import { PrismaClient, DocumentCategory, LeaseStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create user who will own a property
  const ownerPassword = await bcrypt.hash('owner123', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      password: ownerPassword,
      firstName: 'John',
      lastName: 'Owner',
    },
  });
  console.log('Created property owner:', owner.email);

  // Create user who will be a tenant
  const tenantPassword = await bcrypt.hash('tenant123', 10);
  const tenant = await prisma.user.upsert({
    where: { email: 'tenant@example.com' },
    update: {},
    create: {
      email: 'tenant@example.com',
      password: tenantPassword,
      firstName: 'Jane',
      lastName: 'Doe',
    },
  });
  console.log('Created tenant user:', tenant.email);

  // Create property
  const property = await prisma.property.upsert({
    where: { id: 'seed-property-1' },
    update: {},
    create: {
      id: 'seed-property-1',
      title: 'Downtown Apartment',
      address: '123 Main Street, Apt 4B',
      city: 'Tel Aviv',
      squareMeters: 85,
      rooms: 3,
      floor: 4,
      hasBalcony: true,
      hasParking: true,
      hasStorage: false,
      notes: 'Great view of the city',
      ownerId: owner.id,
    },
  });
  console.log('Created property:', property.title);

  // Create active lease for tenant (tenant already connected)
  await prisma.lease.upsert({
    where: { id: 'seed-lease-1' },
    update: {},
    create: {
      id: 'seed-lease-1',
      propertyId: property.id,
      tenantId: tenant.id,
      status: LeaseStatus.ACTIVE,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      monthlyRent: 5000,
      depositAmount: 15000,
      notes: 'One year lease agreement',
    },
  });
  console.log('Created active lease for tenant');

  // Create sample property document (with its StoredFile)
  await prisma.storedFile.upsert({
    where: { id: 'seed-storedfile-1' },
    update: {},
    create: {
      id: 'seed-storedfile-1',
      storageKey: 'properties/seed/documents/seed-storedfile-1.pdf',
      originalFilename: 'property-insurance-2024.pdf',
      mimeType: 'application/pdf',
      fileExtension: 'pdf',
      fileSize: 245000,
      storageProvider: 's3',
      uploadedById: owner.id,
    },
  });
  await prisma.document.upsert({
    where: { id: 'seed-document-1' },
    update: {},
    create: {
      id: 'seed-document-1',
      name: 'Property Insurance 2024',
      category: DocumentCategory.INSURANCE,
      propertyId: property.id,
      uploadedById: owner.id,
      storedFileId: 'seed-storedfile-1',
    },
  });
  console.log('Created sample property document');

  // Create sample lease document (with its StoredFile)
  await prisma.storedFile.upsert({
    where: { id: 'seed-storedfile-2' },
    update: {},
    create: {
      id: 'seed-storedfile-2',
      storageKey: 'leases/seed-lease-1/documents/seed-storedfile-2.pdf',
      originalFilename: 'signed-lease-2024.pdf',
      mimeType: 'application/pdf',
      fileExtension: 'pdf',
      fileSize: 320000,
      storageProvider: 's3',
      uploadedById: owner.id,
    },
  });
  await prisma.document.upsert({
    where: { id: 'seed-document-2' },
    update: {},
    create: {
      id: 'seed-document-2',
      name: 'Signed Lease Agreement',
      category: DocumentCategory.SIGNED_LEASE,
      leaseId: 'seed-lease-1',
      uploadedById: owner.id,
      storedFileId: 'seed-storedfile-2',
    },
  });
  console.log('Created sample lease document');

  // Create sample maintenance request
  await prisma.maintenanceRequest.upsert({
    where: { id: 'seed-maintenance-1' },
    update: {},
    create: {
      id: 'seed-maintenance-1',
      title: 'Leaky faucet in bathroom',
      description: 'The bathroom sink faucet has been dripping for a few days.',
      propertyId: property.id,
      requesterId: tenant.id,
      priority: 2,
    },
  });
  console.log('Created sample maintenance request');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

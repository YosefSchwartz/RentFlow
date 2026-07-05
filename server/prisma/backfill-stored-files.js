/**
 * One-time data migration: split embedded storage metadata out of the business
 * tables (Document, PropertyMedia, MaintenanceAttachment) into StoredFile rows,
 * linking each business row via storedFileId.
 *
 * Idempotent: rows that already have storedFileId are skipped. Safe to re-run.
 *
 * Run AFTER migration 20260627150000_add_stored_file and BEFORE the migration
 * that makes media.storedFileId NOT NULL / drops the old columns.
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BUCKET =
  process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || 'keynest-local-documents';

function extractKey(url) {
  if (!url) return null;
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.substring(idx + marker.length);
  // Fallback: path after host
  try {
    const p = new URL(url).pathname;
    return p.startsWith('/') ? p.slice(1) : p;
  } catch {
    return null;
  }
}

function extOf(key, filename) {
  const from = (s) => (s && s.includes('.') ? s.split('.').pop().toLowerCase() : null);
  return from(key) || from(filename) || null;
}

async function createStoredFile({ url, originalFilename, mimeType, fileSize, uploadedById, createdAt }) {
  const storageKey = extractKey(url);
  if (!storageKey) throw new Error(`Cannot extract key from url: ${url}`);
  return prisma.storedFile.create({
    data: {
      storageKey,
      originalFilename: originalFilename || storageKey.split('/').pop(),
      mimeType: mimeType || 'application/octet-stream',
      fileExtension: extOf(storageKey, originalFilename),
      fileSize: fileSize ?? 0,
      storageProvider: 's3',
      uploadedById: uploadedById ?? null,
      createdAt: createdAt ?? undefined,
    },
  });
}

async function main() {
  let created = 0;

  // Documents (only those with a file; REQUESTED docs have none)
  const docs = await prisma.document.findMany({
    where: { fileUrl: { not: null }, storedFileId: null },
  });
  for (const d of docs) {
    const sf = await createStoredFile({
      url: d.fileUrl,
      originalFilename: d.name,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      uploadedById: d.uploadedById,
      createdAt: d.createdAt,
    });
    await prisma.document.update({ where: { id: d.id }, data: { storedFileId: sf.id } });
    created++;
  }
  console.log(`Documents migrated: ${docs.length}`);

  // Property media
  const media = await prisma.propertyMedia.findMany({ where: { storedFileId: null } });
  for (const m of media) {
    const sf = await createStoredFile({
      url: m.url,
      originalFilename: m.fileName,
      mimeType: m.mimeType,
      fileSize: m.size,
      uploadedById: m.uploadedById,
      createdAt: m.createdAt,
    });
    await prisma.propertyMedia.update({ where: { id: m.id }, data: { storedFileId: sf.id } });
    created++;
  }
  console.log(`Property media migrated: ${media.length}`);

  // Maintenance attachments
  const atts = await prisma.maintenanceAttachment.findMany({ where: { storedFileId: null } });
  for (const a of atts) {
    const sf = await createStoredFile({
      url: a.url,
      originalFilename: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.size,
      uploadedById: a.uploadedById,
      createdAt: a.createdAt,
    });
    await prisma.maintenanceAttachment.update({ where: { id: a.id }, data: { storedFileId: sf.id } });
    created++;
  }
  console.log(`Maintenance attachments migrated: ${atts.length}`);

  console.log(`\nTotal StoredFile rows created: ${created}`);
}

main()
  .catch((e) => {
    console.error('BACKFILL FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

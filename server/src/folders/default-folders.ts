import { SystemFolderKey } from '@prisma/client';

/**
 * The system folders created for every property. They cannot be renamed, moved
 * or deleted (see FoldersService). `name` is the server-side default label; the
 * mobile client translates by `systemKey` for i18n/RTL.
 */
export const DEFAULT_SYSTEM_FOLDERS: {
  name: string;
  systemKey: SystemFolderKey;
}[] = [
  { name: 'Contracts', systemKey: SystemFolderKey.CONTRACTS },
  { name: 'Receipts', systemKey: SystemFolderKey.RECEIPTS },
  { name: 'Property Plans', systemKey: SystemFolderKey.PROPERTY_PLANS },
  { name: 'Insurance', systemKey: SystemFolderKey.INSURANCE },
  { name: 'Municipality', systemKey: SystemFolderKey.MUNICIPALITY },
  { name: 'General', systemKey: SystemFolderKey.GENERAL },
];

/**
 * Build the createMany payload for a property's default system folders.
 * Shared by property creation and (conceptually) the migration backfill.
 */
export function buildDefaultFolders(propertyId: string, createdById: string) {
  return DEFAULT_SYSTEM_FOLDERS.map((f) => ({
    name: f.name,
    systemKey: f.systemKey,
    isSystem: true,
    propertyId,
    createdById,
  }));
}

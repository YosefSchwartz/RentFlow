import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getAccessToken } from '../services/auth';

const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

/**
 * Download a remote file to the app cache and open the OS share sheet so the
 * user can save it to Files, share it, or open it in another app.
 *
 * Shared by document downloads and the media viewer. Throws if the device has
 * no sharing capability or the download fails (caller should surface an error).
 */
export async function downloadAndShare(
  url: string,
  displayName?: string,
  mimeType?: string,
): Promise<void> {
  if (!url) {
    throw new Error('No file URL to download');
  }

  // Build a friendly local filename, preserving an extension when possible.
  const cleanUrl = url.split('?')[0];
  const urlExt = cleanUrl.includes('.')
    ? cleanUrl.split('.').pop()
    : undefined;
  let base = (displayName || 'file').trim();
  if (!base.includes('.') && urlExt) {
    base = `${base}.${urlExt}`;
  }

  const dir = FileSystem.cacheDirectory;
  if (!dir) {
    throw new Error('File system is not available on this platform');
  }

  const { uri } = await FileSystem.downloadAsync(url, `${dir}${sanitize(base)}`);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(uri, {
    mimeType: mimeType || undefined,
    dialogTitle: displayName || undefined,
  });
}

/**
 * Download a file from an authenticated API endpoint (sends the JWT) into the
 * cache and open the OS share sheet. Used by receipt CSV/ZIP exports, whose
 * endpoints require auth (unlike signed S3 URLs, which don't).
 */
export async function downloadAuthedAndShare(
  url: string,
  displayName: string,
  mimeType?: string,
): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) {
    throw new Error('File system is not available on this platform');
  }

  const token = await getAccessToken();
  const { uri, status } = await FileSystem.downloadAsync(
    url,
    `${dir}${sanitize(displayName)}`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );

  if (status >= 400) {
    throw new Error(`Export failed (${status})`);
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(uri, {
    mimeType: mimeType || undefined,
    dialogTitle: displayName,
  });
}

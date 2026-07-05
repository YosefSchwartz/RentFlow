import * as ImagePicker from 'expo-image-picker';
import type { LocalMediaFile, MediaType } from '../../types';

/**
 * Shared media-picking helper used by BOTH the property gallery and the
 * maintenance attachments flow. Wraps expo-image-picker (camera + library)
 * and normalizes results into LocalMediaFile.
 *
 * Only the picking mechanics are shared — the domains stay separate.
 */

export interface PickResult {
  /** True if the user dismissed the picker without choosing. */
  canceled: boolean;
  /** True if a required OS permission was denied. */
  denied: boolean;
  files: LocalMediaFile[];
}

const CANCELED: PickResult = { canceled: true, denied: false, files: [] };
const DENIED: PickResult = { canceled: false, denied: true, files: [] };

// Infer a backend-accepted mime type from an extension when the OS omits one.
const mimeFromExtension = (uri: string, mediaType: MediaType): string => {
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'mov':
      return 'video/quicktime';
    case 'mp4':
      return 'video/mp4';
    default:
      return mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg';
  }
};

const fileNameFromUri = (uri: string, mediaType: MediaType): string => {
  const fromUri = uri.split('/').pop();
  if (fromUri && fromUri.includes('.')) return fromUri;
  return mediaType === 'VIDEO' ? 'video.mp4' : 'photo.jpg';
};

const toLocalMediaFile = (
  asset: ImagePicker.ImagePickerAsset
): LocalMediaFile => {
  const mediaType: MediaType = asset.type === 'video' ? 'VIDEO' : 'IMAGE';
  const name = asset.fileName || fileNameFromUri(asset.uri, mediaType);
  const type = asset.mimeType || mimeFromExtension(asset.uri, mediaType);
  return { uri: asset.uri, name, type, mediaType };
};

const mapResult = (result: ImagePicker.ImagePickerResult): PickResult => {
  if (result.canceled) return CANCELED;
  return {
    canceled: false,
    denied: false,
    files: result.assets.map(toLocalMediaFile),
  };
};

/** Launch the camera to take a single photo. */
export async function takePhoto(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return DENIED;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  return mapResult(result);
}

/** Launch the camera to record a single video. */
export async function recordVideo(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return DENIED;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    quality: 0.8,
    videoMaxDuration: 120,
  });
  return mapResult(result);
}

/** Pick one or more photos/videos from the device library. */
export async function pickFromLibrary(
  allowsMultipleSelection = true,
  selectionLimit?: number
): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return DENIED;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection,
    selectionLimit,
    quality: 0.8,
  });
  return mapResult(result);
}

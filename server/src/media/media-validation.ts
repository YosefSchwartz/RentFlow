import { BadRequestException } from '@nestjs/common';
import { MediaType } from '@prisma/client';

/**
 * Media validation rules (allowed MIME types + size limits) shared by every
 * business domain that accepts images/videos. Business meaning stays in the
 * owning module; only the rules live here.
 */

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB — smaller than the general image cap

// jpg/jpeg -> image/jpeg, png -> image/png, heic/heif -> image/heic|heif
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
];

// mp4 -> video/mp4, mov -> video/quicktime
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'];

export const ACCEPTED_MEDIA_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
];

/** Regex form for NestJS FileTypeValidator (a coarse guard at the controller). */
export const MEDIA_MIME_TYPE_REGEX =
  /^(image\/(jpeg|png|heic|heif)|video\/(mp4|quicktime))$/;

/** Images only (no video) — avatars. */
export const IMAGE_MIME_TYPE_REGEX = /^image\/(jpeg|png|heic|heif)$/;

/** Resolve the domain media type from a MIME type, or null if unsupported. */
export function resolveMediaType(mimeType: string): MediaType | null {
  if (IMAGE_MIME_TYPES.includes(mimeType)) return MediaType.IMAGE;
  if (VIDEO_MIME_TYPES.includes(mimeType)) return MediaType.VIDEO;
  return null;
}

/**
 * Validate a media file's MIME type and size (size limits depend on type).
 * Returns the resolved MediaType. Throws BadRequestException on failure.
 */
export function validateMediaFile(mimeType: string, size: number): MediaType {
  const type = resolveMediaType(mimeType);

  if (!type) {
    throw new BadRequestException(
      `Unsupported file type "${mimeType}". Allowed: jpg, jpeg, png, heic, mp4, mov.`,
    );
  }

  const maxSize = type === MediaType.IMAGE ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (size > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    throw new BadRequestException(
      `${type === MediaType.IMAGE ? 'Image' : 'Video'} exceeds the maximum size of ${maxMb} MB.`,
    );
  }

  return type;
}

/**
 * Validate an avatar image's MIME type and size. Images only (no video),
 * smaller cap than the general image limit. Throws BadRequestException on
 * failure.
 */
export function validateAvatarFile(mimeType: string, size: number): void {
  if (!IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new BadRequestException(
      `Unsupported file type "${mimeType}". Allowed: jpg, jpeg, png, heic.`,
    );
  }

  if (size > MAX_AVATAR_SIZE) {
    const maxMb = Math.round(MAX_AVATAR_SIZE / (1024 * 1024));
    throw new BadRequestException(`Image exceeds the maximum size of ${maxMb} MB.`);
  }
}

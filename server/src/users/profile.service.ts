import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoredFileService } from '../media/stored-file.service';
import { validateAvatarFile } from '../media/media-validation';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface ProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  avatarUrl: string | null;
}

/**
 * Profile viewing/editing — distinct from UsersService's account-lifecycle
 * concerns (create/delete).
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storedFileService: StoredFileService,
  ) {}

  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        avatarStoredFile: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { avatarStoredFile, ...rest } = user;
    // Only the FK is ever persisted — the signed URL is generated fresh on
    // every read, so it's never stale and never leaks a long-lived signed
    // URL into the DB/logs.
    const avatarUrl = avatarStoredFile
      ? await this.storedFileService.getDownloadUrl(avatarStoredFile)
      : null;

    return { ...rest, avatarUrl };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponse> {
    await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    return this.getProfile(userId);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<ProfileResponse> {
    validateAvatarFile(file.mimetype, file.size);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarStoredFileId: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const previousAvatarStoredFileId = user.avatarStoredFileId;

    const storedFile = await this.storedFileService.upload({
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      keyParts: ['users', userId, 'avatar'],
      uploadedById: userId,
    });

    // Release the RESTRICT FK on the old file (if any) before deleting it —
    // same ordering PropertyMediaService.delete uses.
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarStoredFileId: storedFile.id },
    });

    if (previousAvatarStoredFileId) {
      try {
        await this.storedFileService.delete(previousAvatarStoredFileId);
      } catch (error) {
        this.logger.warn(
          `Failed to delete previous avatar StoredFile ${previousAvatarStoredFileId}`,
          error as Error,
        );
      }
    }

    return this.getProfile(userId);
  }
}

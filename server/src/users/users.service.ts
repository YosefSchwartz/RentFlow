import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User, LeaseStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    return this.prisma.user.create({
      data: dto,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        phone: true,
        pendingEmail: true,
        pendingEmailExpiresAt: true,
        avatarStoredFileId: true,
      },
    });
    return users;
  }

  async getDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    const ownedPropertiesCount = await this.prisma.property.count({
      where: { ownerId: userId },
    });

    const activeLeasesCount = await this.prisma.lease.count({
      where: {
        tenantId: userId,
        status: LeaseStatus.ACTIVE,
      },
    });

    return {
      user,
      ownedPropertiesCount,
      activeLeasesCount,
      canAccessLandlord: ownedPropertiesCount > 0,
      // A tenant has access once they hold an active lease (redeemed a code).
      canAccessTenant: activeLeasesCount > 0,
    };
  }

  /**
   * Permanently delete a user's account and ALL of their data.
   *
   * Requires re-authentication (password). Strategy:
   *  1. Collect every StoredFile reachable from data that WILL be deleted —
   *     business rows (documents/media/attachments) don't cascade to StoredFile
   *     (FK points business -> StoredFile), so they'd otherwise orphan in S3.
   *  2. In one DB transaction: delete the user (FK cascades remove owned
   *     properties + their leases/docs/media/maintenance, the user's maintenance
   *     requests, sessions, notifications; the user's own leases as tenant are
   *     SET NULL so the landlord keeps that lease history), then delete the now
   *     unreferenced StoredFile rows.
   *  3. After the DB is consistent, delete the underlying storage objects
   *     (best-effort) so no orphan files remain.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Re-authentication.
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Incorrect password');
    }

    // Properties this landlord owns are cascade-deleted with the user.
    const ownedProperties = await this.prisma.property.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const propertyIds = ownedProperties.map((p) => p.id);

    // Every StoredFile whose owning business row will be removed by this delete.
    const storedFiles = await this.prisma.storedFile.findMany({
      where: {
        OR: [
          // Documents on owned properties or on those properties' leases.
          {
            document: {
              OR: [
                { propertyId: { in: propertyIds } },
                { lease: { propertyId: { in: propertyIds } } },
              ],
            },
          },
          // Photos/videos on owned properties.
          { propertyMedia: { propertyId: { in: propertyIds } } },
          // Maintenance attachments on owned properties OR on requests this
          // user created (those requests cascade-delete with the user).
          {
            maintenanceAttachment: {
              maintenanceRequest: {
                OR: [
                  { propertyId: { in: propertyIds } },
                  { requesterId: userId },
                ],
              },
            },
          },
          // Files this user uploaded that aren't attached to anything (e.g.
          // an abandoned pre-signed upload).
          {
            uploadedById: userId,
            document: { is: null },
            propertyMedia: { is: null },
            maintenanceAttachment: { is: null },
          },
        ],
      },
      select: { id: true, storageKey: true },
    });

    const storedFileIds = storedFiles.map((f) => f.id);

    // DB-first for consistency: if this transaction fails, nothing is deleted.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: userId } });
      if (storedFileIds.length > 0) {
        // Business rows referencing these are gone (cascade), so this is safe.
        await tx.storedFile.deleteMany({ where: { id: { in: storedFileIds } } });
      }
    });

    // Storage cleanup (best-effort). DB is already consistent; a failed object
    // delete only leaves recoverable storage, never a dangling DB reference.
    for (const file of storedFiles) {
      try {
        await this.storageService.deleteFile(file.storageKey);
      } catch (error) {
        this.logger.warn(
          `Account deletion: failed to delete storage object ${file.storageKey}`,
          error as Error,
        );
      }
    }

    this.logger.log(
      `Account ${userId} deleted (${storedFileIds.length} stored files removed).`,
    );
  }
}

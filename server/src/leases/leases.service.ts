import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Lease, LeaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeaseDto } from './dto/create-lease.dto';

// Activation codes are valid for 30 days; the landlord can regenerate.
const ACTIVATION_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PROPERTY_SELECT = {
  id: true,
  title: true,
  address: true,
  city: true,
  squareMeters: true,
  rooms: true,
  floor: true,
  hasBalcony: true,
  hasParking: true,
  hasStorage: true,
  hasShelter: true,
  notes: true,
  ownerId: true,
  owner: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

const TENANT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

@Injectable()
export class LeasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private generateActivationCode(): string {
    return randomBytes(6).toString('hex').toUpperCase();
  }

  private newCodeExpiry(): Date {
    return new Date(Date.now() + ACTIVATION_CODE_TTL_MS);
  }

  /** Remove the activation code from a lease unless the viewer is the owner. */
  private redactCode<
    T extends { activationCode: string | null; activationCodeExpiresAt: Date | null },
  >(lease: T, isOwner: boolean): T {
    if (isOwner) return lease;
    return { ...lease, activationCode: null, activationCodeExpiresAt: null };
  }

  /**
   * Create a landlord-owned lease with NO tenant. Generates an activation code
   * the landlord shares; a tenant redeems it to become the lease's tenant.
   */
  async create(
    propertyId: string,
    dto: CreateLeaseDto,
    userId: string,
  ): Promise<Lease> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (property.ownerId !== userId) {
      throw new ForbiddenException('Only the property owner can create leases');
    }

    return this.prisma.lease.create({
      data: {
        propertyId,
        tenantId: null,
        status: LeaseStatus.PENDING,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        monthlyRent: dto.monthlyRent,
        depositAmount: dto.depositAmount,
        notes: dto.notes,
        activationCode: this.generateActivationCode(),
        activationCodeExpiresAt: this.newCodeExpiry(),
      },
      include: {
        property: { select: PROPERTY_SELECT },
        tenant: { select: TENANT_SELECT },
      },
    });
  }

  /** A tenant redeems a lease activation code and becomes the lease's tenant. */
  async redeem(code: string, userId: string): Promise<Lease> {
    const lease = await this.prisma.lease.findUnique({
      where: { activationCode: code },
      include: { property: { select: { id: true, title: true, ownerId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Invalid activation code');
    }
    if (
      lease.activationCodeExpiresAt &&
      lease.activationCodeExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('This activation code has expired');
    }
    if (lease.tenantId) {
      throw new ConflictException('This lease already has a tenant');
    }
    if (lease.property.ownerId === userId) {
      throw new BadRequestException(
        'You cannot join your own property as a tenant',
      );
    }

    // One active lease per tenant per property.
    const existing = await this.prisma.lease.findFirst({
      where: {
        propertyId: lease.propertyId,
        tenantId: userId,
        status: LeaseStatus.ACTIVE,
      },
    });
    if (existing) {
      throw new ConflictException(
        'You already have an active lease for this property',
      );
    }

    const updated = await this.prisma.lease.update({
      where: { id: lease.id },
      data: {
        tenantId: userId,
        status: LeaseStatus.ACTIVE,
        activationCode: null,
        activationCodeExpiresAt: null,
      },
      include: {
        property: { select: PROPERTY_SELECT },
        tenant: { select: TENANT_SELECT },
      },
    });

    const tenant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const tenantName = tenant
      ? `${tenant.firstName} ${tenant.lastName}`
      : 'A tenant';
    await this.notifications.notifyLeaseActivated(
      lease.property.ownerId,
      tenantName,
      lease.property.title,
      lease.id,
    );

    return updated; // code already cleared above
  }

  /** Owner regenerates the activation code for an as-yet unassigned lease. */
  async regenerateCode(id: string, userId: string): Promise<Lease> {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      include: { property: { select: { ownerId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
    if (lease.property.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the property owner can manage the activation code',
      );
    }
    if (lease.tenantId) {
      throw new BadRequestException('This lease already has a tenant');
    }

    return this.prisma.lease.update({
      where: { id },
      data: {
        activationCode: this.generateActivationCode(),
        activationCodeExpiresAt: this.newCodeExpiry(),
      },
      include: {
        property: { select: PROPERTY_SELECT },
        tenant: { select: TENANT_SELECT },
      },
    });
  }

  async findOne(id: string, userId: string): Promise<Lease> {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      include: {
        property: { select: PROPERTY_SELECT },
        tenant: { select: TENANT_SELECT },
      },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    const isOwner = lease.property.ownerId === userId;
    const isTenant = lease.tenantId === userId;
    if (!isOwner && !isTenant) {
      throw new ForbiddenException('You do not have access to this lease');
    }

    return this.redactCode(lease, isOwner);
  }

  /** Owner-only: includes activation codes so the landlord can re-share them. */
  async findAllForProperty(
    propertyId: string,
    userId: string,
  ): Promise<Lease[]> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (property.ownerId !== userId) {
      throw new ForbiddenException('Only the property owner can view leases');
    }

    return this.prisma.lease.findMany({
      where: { propertyId },
      include: { tenant: { select: TENANT_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyLeases(userId: string): Promise<Lease[]> {
    const leases = await this.prisma.lease.findMany({
      where: { tenantId: userId },
      include: { property: { select: PROPERTY_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return leases.map((l) => this.redactCode(l, false));
  }

  async updateStatus(
    id: string,
    status: LeaseStatus,
    userId: string,
  ): Promise<Lease> {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      include: { property: { select: { ownerId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
    if (lease.property.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the property owner can update lease status',
      );
    }

    return this.prisma.lease.update({
      where: { id },
      data: { status },
      include: {
        property: { select: PROPERTY_SELECT },
        tenant: { select: TENANT_SELECT },
      },
    });
  }

  async hasActiveLease(propertyId: string, userId: string): Promise<boolean> {
    const lease = await this.prisma.lease.findFirst({
      where: { propertyId, tenantId: userId, status: LeaseStatus.ACTIVE },
    });
    return !!lease;
  }

  async countActiveLeases(userId: string): Promise<number> {
    return this.prisma.lease.count({
      where: { tenantId: userId, status: LeaseStatus.ACTIVE },
    });
  }
}

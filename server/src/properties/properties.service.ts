import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Property, LeaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { buildDefaultFolders } from '../folders/default-folders';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePropertyDto, ownerId: string): Promise<Property> {
    // Create the property and its six default system folders atomically, so a
    // new property is never left without its document folder structure.
    return this.prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: {
          title: dto.title,
          address: dto.location.formattedAddress,
          city: dto.location.city,
          formattedAddress: dto.location.formattedAddress,
          street: dto.location.street,
          streetNumber: dto.location.streetNumber,
          latitude: dto.location.latitude,
          longitude: dto.location.longitude,
          placeId: dto.location.placeId,
          squareMeters: dto.squareMeters,
          rooms: dto.rooms,
          floor: dto.floor,
          hasBalcony: dto.hasBalcony,
          hasParking: dto.hasParking,
          hasStorage: dto.hasStorage,
          hasShelter: dto.hasShelter,
          notes: dto.notes,
          ownerId,
        },
      });

      await tx.folder.createMany({
        data: buildDefaultFolders(property.id, ownerId),
      });

      return property;
    });
  }

  async findAllOwned(userId: string): Promise<Property[]> {
    return this.prisma.property.findMany({
      where: { ownerId: userId },
      include: {
        leases: {
          where: { status: LeaseStatus.ACTIVE },
          include: {
            tenant: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllRented(userId: string): Promise<Property[]> {
    return this.prisma.property.findMany({
      where: {
        leases: {
          some: {
            tenantId: userId,
            status: LeaseStatus.ACTIVE,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForUser(userId: string) {
    const [owned, rented] = await Promise.all([
      this.findAllOwned(userId),
      this.findAllRented(userId),
    ]);

    return {
      owned,
      rented,
    };
  }

  async findOne(id: string, userId: string): Promise<Property> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        leases: {
          where: { status: LeaseStatus.ACTIVE },
          include: {
            tenant: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        documents: true,
        maintenanceRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const hasAccess = await this.userHasAccess(id, userId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this property');
    }

    return property;
  }

  async update(
    id: string,
    dto: UpdatePropertyDto,
    userId: string,
  ): Promise<Property> {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can update this property');
    }

    // Build update data, flattening location if provided
    const { location, ...rest } = dto;
    const updateData: any = { ...rest };

    if (location) {
      updateData.address = location.formattedAddress;
      updateData.city = location.city;
      updateData.formattedAddress = location.formattedAddress;
      updateData.street = location.street;
      updateData.streetNumber = location.streetNumber;
      updateData.latitude = location.latitude;
      updateData.longitude = location.longitude;
      updateData.placeId = location.placeId;
    }

    return this.prisma.property.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this property');
    }

    await this.prisma.property.delete({
      where: { id },
    });
  }

  async userHasAccess(propertyId: string, userId: string): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        leases: {
          where: { tenantId: userId, status: LeaseStatus.ACTIVE },
        },
      },
    });

    if (!property) {
      return false;
    }

    // User is owner
    if (property.ownerId === userId) {
      return true;
    }

    // User has active lease
    return property.leases.length > 0;
  }

  async isOwner(propertyId: string, userId: string): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    return property?.ownerId === userId;
  }

  async isTenant(propertyId: string, userId: string): Promise<boolean> {
    const lease = await this.prisma.lease.findFirst({
      where: {
        propertyId,
        tenantId: userId,
        status: LeaseStatus.ACTIVE,
      },
    });
    return !!lease;
  }
}

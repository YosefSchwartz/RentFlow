import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LeaseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PropertyAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const propertyId = request.params.propertyId || request.params.id;

    if (!propertyId) {
      return true; // No property ID in route, skip check
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Check if user is owner
    if (property.ownerId === user.id) {
      return true;
    }

    // Check if user has an active lease
    const activeLease = await this.prisma.lease.findFirst({
      where: {
        propertyId,
        tenantId: user.id,
        status: LeaseStatus.ACTIVE,
      },
    });

    if (activeLease) {
      return true;
    }

    throw new ForbiddenException('You do not have access to this property');
  }
}

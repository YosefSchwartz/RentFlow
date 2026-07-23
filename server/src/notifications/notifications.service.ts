import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, Notification } from '@prisma/client';
import { CreateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateNotificationDto): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
      },
    });
  }

  async findAllForUser(userId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to most recent 100 notifications
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markAsRead(id: string, userId: string): Promise<Notification | null> {
    // First verify the notification belongs to the user
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return null;
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return result.count;
  }

  /**
   * Mark all of a user's notifications tied to a given entity as read.
   * Used when the user opens a maintenance request's conversation.
   */
  async markReadByEntity(
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        entityType,
        entityId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return result.count;
  }

  // A tenant redeemed a lease activation code and is now the lease's tenant.
  async notifyLeaseActivated(
    landlordId: string,
    tenantName: string,
    propertyTitle: string,
    leaseId: string,
  ): Promise<Notification> {
    return this.create({
      userId: landlordId,
      type: NotificationType.LEASE_PENDING,
      title: 'Tenant Joined Lease',
      message: `${tenantName} has joined your lease at "${propertyTitle}".`,
      entityType: 'lease',
      entityId: leaseId,
    });
  }

  async notifyLeaseApproved(
    tenantId: string,
    propertyTitle: string,
    leaseId: string,
  ): Promise<Notification> {
    return this.create({
      userId: tenantId,
      type: NotificationType.LEASE_APPROVED,
      title: 'Lease Approved',
      message: `Your lease for "${propertyTitle}" has been approved.`,
      entityType: 'lease',
      entityId: leaseId,
    });
  }

  // The landlord changed the pricing schedule of a lease the tenant is on.
  async notifyLeaseTermsUpdated(
    tenantId: string,
    propertyTitle: string,
    leaseId: string,
  ): Promise<Notification> {
    return this.create({
      userId: tenantId,
      type: NotificationType.LEASE_TERMS_UPDATED,
      title: 'Lease Pricing Updated',
      message: `The pricing schedule of your lease at "${propertyTitle}" has been updated.`,
      entityType: 'lease',
      entityId: leaseId,
    });
  }

  async notifyMaintenanceCreated(
    landlordId: string,
    tenantName: string,
    propertyTitle: string,
    requestTitle: string,
    requestId: string,
  ): Promise<Notification> {
    return this.create({
      userId: landlordId,
      type: NotificationType.MAINTENANCE_CREATED,
      title: 'New Maintenance Request',
      message: `${tenantName} reported an issue at "${propertyTitle}": ${requestTitle}`,
      entityType: 'maintenance',
      entityId: requestId,
    });
  }

  async notifyMaintenanceUpdated(
    tenantId: string,
    propertyTitle: string,
    requestTitle: string,
    newStatus: string,
    requestId: string,
  ): Promise<Notification> {
    return this.create({
      userId: tenantId,
      type: NotificationType.MAINTENANCE_UPDATED,
      title: 'Maintenance Request Updated',
      message: `Your maintenance request "${requestTitle}" at "${propertyTitle}" is now ${newStatus}.`,
      entityType: 'maintenance',
      entityId: requestId,
    });
  }

  async notifyMaintenanceComment(
    recipientId: string,
    authorName: string,
    requestTitle: string,
    requestId: string,
  ): Promise<Notification> {
    return this.create({
      userId: recipientId,
      type: NotificationType.MAINTENANCE_COMMENT,
      title: 'New Maintenance Message',
      message: `${authorName} commented on "${requestTitle}".`,
      entityType: 'maintenance',
      entityId: requestId,
    });
  }

  // entityId holds the propertyId so the client can navigate to the tenant's
  // documents screen for that property.
  async notifyDocumentUploaded(
    tenantId: string,
    propertyTitle: string,
    documentName: string,
    propertyId: string,
  ): Promise<Notification> {
    return this.create({
      userId: tenantId,
      type: NotificationType.DOCUMENT_UPLOADED,
      title: 'New Document Available',
      message: `A new document "${documentName}" has been added to "${propertyTitle}".`,
      entityType: 'document',
      entityId: propertyId,
    });
  }

  // Landlord requested a document from a tenant. entityId holds the propertyId
  // so the tenant can navigate to their documents screen for that property.
  async notifyDocumentRequested(
    tenantId: string,
    documentName: string,
    propertyId: string,
  ): Promise<Notification> {
    return this.create({
      userId: tenantId,
      type: NotificationType.DOCUMENT_REQUESTED,
      title: 'New Document Request',
      message: `You have a new document request: "${documentName}".`,
      entityType: 'document',
      entityId: propertyId,
    });
  }

  // Tenant uploaded a previously requested document. entityId holds the
  // propertyId so the landlord can navigate to the property documents screen.
  async notifyRequestedDocumentUploaded(
    landlordId: string,
    tenantName: string,
    documentName: string,
    propertyId: string,
  ): Promise<Notification> {
    return this.create({
      userId: landlordId,
      type: NotificationType.DOCUMENT_UPLOADED,
      title: 'Requested Document Uploaded',
      message: `${tenantName} uploaded the requested document "${documentName}".`,
      entityType: 'document',
      entityId: propertyId,
    });
  }

  async notifyPasswordChanged(userId: string): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.PASSWORD_CHANGED,
      title: 'Password Changed',
      message:
        "Your password was recently changed. If this wasn't you, contact support immediately.",
    });
  }
}

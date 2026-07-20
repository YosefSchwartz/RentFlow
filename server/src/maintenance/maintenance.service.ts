import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  MaintenanceRequest,
  MaintenanceComment,
  MaintenanceAttachment,
  StoredFile,
  MaintenanceStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StoredFileService } from '../media/stored-file.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

/** A comment as returned by the API — includes its author and linked attachment, if any. */
export interface MaintenanceCommentResponse extends MaintenanceComment {
  author: { id: string; email: string; firstName: string; lastName: string };
  attachment: {
    id: string;
    type: string;
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
  } | null;
}

// Reusable select for any user shown alongside a request/comment.
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

// A comment notification is suppressed if the recipient opened the
// conversation within this window (they are considered "recently active").
const RECENTLY_ACTIVE_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propertiesService: PropertiesService,
    private readonly notifications: NotificationsService,
    private readonly storedFileService: StoredFileService,
  ) {}

  /** Shape a comment's linked attachment (if any) with a signed download URL. */
  private async toCommentResponse(
    comment: MaintenanceComment & {
      author: { id: string; email: string; firstName: string; lastName: string };
      attachment: (MaintenanceAttachment & { storedFile: StoredFile }) | null;
    },
  ): Promise<MaintenanceCommentResponse> {
    if (!comment.attachment) {
      return { ...comment, attachment: null };
    }
    const { attachment } = comment;
    const url = await this.storedFileService.getDownloadUrl(
      attachment.storedFile,
    );
    return {
      ...comment,
      attachment: {
        id: attachment.id,
        type: attachment.type,
        url,
        fileName: attachment.storedFile.originalFilename,
        mimeType: attachment.storedFile.mimeType,
        size: attachment.storedFile.fileSize,
      },
    };
  }

  async create(
    propertyId: string,
    dto: CreateMaintenanceRequestDto,
    userId: string,
  ): Promise<MaintenanceRequest> {
    const hasAccess = await this.propertiesService.userHasAccess(
      propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this property');
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true, title: true },
    });

    const request = await this.prisma.maintenanceRequest.create({
      data: {
        ...dto,
        propertyId,
        requesterId: userId,
      },
      include: { requester: { select: USER_SELECT } },
    });

    // Notify the property owner when a tenant (not the owner) reports an issue.
    if (property && property.ownerId !== userId) {
      const requesterName = `${request.requester.firstName} ${request.requester.lastName}`;
      await this.notifications.notifyMaintenanceCreated(
        property.ownerId,
        requesterName,
        property.title,
        request.title,
        request.id,
      );
    }

    return request;
  }

  async findAllForProperty(
    propertyId: string,
    userId: string,
  ): Promise<MaintenanceRequest[]> {
    const hasAccess = await this.propertiesService.userHasAccess(
      propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this property');
    }

    return this.prisma.maintenanceRequest.findMany({
      where: { propertyId },
      include: {
        requester: {
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

  async findOne(id: string, userId: string): Promise<MaintenanceRequest> {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            ownerId: true,
          },
        },
        requester: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    const hasAccess = await this.propertiesService.userHasAccess(
      request.propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this maintenance request',
      );
    }

    return request;
  }

  async update(
    id: string,
    dto: UpdateMaintenanceRequestDto,
    userId: string,
  ): Promise<MaintenanceRequest> {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    const isOwner = await this.propertiesService.isOwner(
      request.propertyId,
      userId,
    );
    const isRequester = request.requesterId === userId;

    // Must be owner or requester to update
    if (!isOwner && !isRequester) {
      throw new ForbiddenException(
        'You do not have permission to update this maintenance request',
      );
    }

    // Only property owner can change status
    if (dto.status && !isOwner) {
      throw new ForbiddenException('Only the property owner can change the status');
    }

    const updateData: any = { ...dto };

    // Set resolvedAt when status changes to RESOLVED
    if (dto.status === MaintenanceStatus.RESOLVED && !request.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    // Reopening (RESOLVED -> IN_PROGRESS): clear resolvedAt, it's no longer resolved.
    if (
      dto.status === MaintenanceStatus.IN_PROGRESS &&
      request.status === MaintenanceStatus.RESOLVED
    ) {
      updateData.resolvedAt = null;
    }

    const statusChanged = !!dto.status && dto.status !== request.status;

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: updateData,
      include: { requester: { select: USER_SELECT } },
    });

    // Notify the tenant when the owner changes the status.
    if (statusChanged && request.requesterId !== userId) {
      await this.notifications.notifyMaintenanceUpdated(
        request.requesterId,
        request.property.title,
        request.title,
        dto.status as string,
        request.id,
      );
    }

    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    const isOwner = await this.propertiesService.isOwner(
      request.propertyId,
      userId,
    );
    const isRequester = request.requesterId === userId;

    // Only property owner or requester can delete
    if (!isOwner && !isRequester) {
      throw new ForbiddenException(
        'You do not have permission to delete this maintenance request',
      );
    }

    await this.prisma.maintenanceRequest.delete({
      where: { id },
    });
  }

  // ============================================
  // Tenant's own requests (across all properties)
  // ============================================

  async findMyRequests(userId: string): Promise<MaintenanceRequest[]> {
    return this.prisma.maintenanceRequest.findMany({
      where: { requesterId: userId },
      include: {
        property: { select: { id: true, title: true, address: true } },
        requester: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // Comments (chat between owner and tenant)
  // ============================================

  async findComments(
    requestId: string,
    userId: string,
  ): Promise<MaintenanceCommentResponse[]> {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      select: { propertyId: true },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    const hasAccess = await this.propertiesService.userHasAccess(
      request.propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this maintenance request',
      );
    }

    const comments = await this.prisma.maintenanceComment.findMany({
      where: { requestId },
      include: {
        author: { select: USER_SELECT },
        attachment: { include: { storedFile: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(comments.map((c) => this.toCommentResponse(c)));
  }

  async addComment(
    requestId: string,
    dto: CreateCommentDto,
    userId: string,
  ): Promise<MaintenanceCommentResponse> {
    if (!dto.body && !dto.attachmentId) {
      throw new BadRequestException(
        'A message must have text, an attachment, or both',
      );
    }

    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: { property: { select: { ownerId: true } } },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    const hasAccess = await this.propertiesService.userHasAccess(
      request.propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this maintenance request',
      );
    }

    if (dto.attachmentId) {
      const attachment = await this.prisma.maintenanceAttachment.findUnique({
        where: { id: dto.attachmentId },
      });
      if (!attachment || attachment.maintenanceRequestId !== requestId) {
        throw new NotFoundException('Attachment not found on this request');
      }
      if (attachment.commentId) {
        throw new BadRequestException(
          'This attachment is already linked to a message',
        );
      }
      const isOwner = request.property.ownerId === userId;
      if (attachment.uploadedById !== userId && !isOwner) {
        throw new ForbiddenException(
          'You do not have permission to use this attachment',
        );
      }
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceComment.create({
        data: { requestId, authorId: userId, body: dto.body ?? null },
      });
      if (dto.attachmentId) {
        await tx.maintenanceAttachment.update({
          where: { id: dto.attachmentId },
          data: { commentId: created.id },
        });
      }
      return tx.maintenanceComment.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          author: { select: USER_SELECT },
          attachment: { include: { storedFile: true } },
        },
      });
    });

    // Writing a comment counts as viewing the conversation.
    await this.touchRead(requestId, userId);

    // Notify the other party (owner ↔ requester), unless they were recently
    // active in this conversation (opened it within the last hour).
    const ownerId = request.property.ownerId;
    const recipientId = userId === ownerId ? request.requesterId : ownerId;
    if (
      recipientId &&
      recipientId !== userId &&
      !(await this.isRecentlyActive(requestId, recipientId))
    ) {
      const authorName = `${comment.author.firstName} ${comment.author.lastName}`;
      await this.notifications.notifyMaintenanceComment(
        recipientId,
        authorName,
        request.title,
        requestId,
      );
    }

    return this.toCommentResponse(comment);
  }

  // ============================================
  // Conversation read tracking
  // ============================================

  /** Record that a user has just viewed a request's conversation. */
  private async touchRead(requestId: string, userId: string): Promise<void> {
    await this.prisma.maintenanceRead.upsert({
      where: { requestId_userId: { requestId, userId } },
      create: { requestId, userId },
      update: { lastReadAt: new Date() },
    });
  }

  /** True if the user opened the conversation within the recent-activity window. */
  private async isRecentlyActive(
    requestId: string,
    userId: string,
  ): Promise<boolean> {
    const read = await this.prisma.maintenanceRead.findUnique({
      where: { requestId_userId: { requestId, userId } },
    });
    if (!read) return false;
    return Date.now() - read.lastReadAt.getTime() < RECENTLY_ACTIVE_MS;
  }

  /**
   * Mark a request's conversation as read by the user: records the view time
   * (drives notification suppression) and clears this request's notifications.
   */
  async markConversationRead(
    requestId: string,
    userId: string,
  ): Promise<{ markedAsRead: number }> {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      select: { propertyId: true },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    const hasAccess = await this.propertiesService.userHasAccess(
      request.propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this maintenance request',
      );
    }

    await this.touchRead(requestId, userId);
    const markedAsRead = await this.notifications.markReadByEntity(
      userId,
      'maintenance',
      requestId,
    );

    return { markedAsRead };
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Folder, SystemFolderKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

export interface FolderResponse {
  id: string;
  name: string;
  isSystem: boolean;
  systemKey: SystemFolderKey | null;
  parentId: string | null;
  propertyId: string;
  createdAt: Date;
  children: FolderResponse[];
}

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propertiesService: PropertiesService,
  ) {}

  private toNode(folder: Folder): FolderResponse {
    return {
      id: folder.id,
      name: folder.name,
      isSystem: folder.isSystem,
      systemKey: folder.systemKey,
      parentId: folder.parentId,
      propertyId: folder.propertyId,
      createdAt: folder.createdAt,
      children: [],
    };
  }

  /** Build a nested tree (roots first) from a flat, order-stable folder list. */
  private buildTree(folders: Folder[]): FolderResponse[] {
    const nodes = new Map<string, FolderResponse>();
    folders.forEach((f) => nodes.set(f.id, this.toNode(f)));

    const roots: FolderResponse[] = [];
    nodes.forEach((node) => {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  /** Full folder tree for a property. Any user with property access may read. */
  async findTreeForProperty(
    propertyId: string,
    userId: string,
  ): Promise<FolderResponse[]> {
    const hasAccess = await this.propertiesService.userHasAccess(
      propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this property');
    }

    const folders = await this.prisma.folder.findMany({
      where: { propertyId },
      // System folders first (stable), then user folders by creation order.
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });

    return this.buildTree(folders);
  }

  private async ensureOwner(propertyId: string, userId: string): Promise<void> {
    const isOwner = await this.propertiesService.isOwner(propertyId, userId);
    if (!isOwner) {
      throw new ForbiddenException(
        'Only the property owner can manage folders',
      );
    }
  }

  /** Validate a parent folder belongs to the given property. */
  private async assertParentInProperty(
    parentId: string,
    propertyId: string,
  ): Promise<void> {
    const parent = await this.prisma.folder.findUnique({
      where: { id: parentId },
      select: { propertyId: true },
    });
    if (!parent || parent.propertyId !== propertyId) {
      throw new BadRequestException(
        'Parent folder does not belong to this property',
      );
    }
  }

  async create(
    propertyId: string,
    dto: CreateFolderDto,
    userId: string,
  ): Promise<FolderResponse> {
    await this.ensureOwner(propertyId, userId);

    if (dto.parentId) {
      await this.assertParentInProperty(dto.parentId, propertyId);
    }

    const folder = await this.prisma.folder.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        propertyId,
        createdById: userId,
        isSystem: false,
      },
    });

    return this.toNode(folder);
  }

  async update(
    id: string,
    dto: UpdateFolderDto,
    userId: string,
  ): Promise<FolderResponse> {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    await this.ensureOwner(folder.propertyId, userId);

    if (folder.isSystem) {
      throw new ForbiddenException(
        'System folders cannot be renamed or moved',
      );
    }

    // Re-parenting: validate target and prevent cycles.
    if (dto.parentId !== undefined && dto.parentId !== folder.parentId) {
      if (dto.parentId) {
        if (dto.parentId === id) {
          throw new BadRequestException('A folder cannot be its own parent');
        }
        await this.assertParentInProperty(dto.parentId, folder.propertyId);
        await this.assertNotDescendant(id, dto.parentId);
      }
    }

    const updated = await this.prisma.folder.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      },
    });

    return this.toNode(updated);
  }

  /** Reject re-parenting a folder under one of its own descendants (cycle). */
  private async assertNotDescendant(
    folderId: string,
    candidateParentId: string,
  ): Promise<void> {
    let cursor: string | null = candidateParentId;
    while (cursor) {
      if (cursor === folderId) {
        throw new BadRequestException(
          'Cannot move a folder inside one of its own subfolders',
        );
      }
      const parent: { parentId: string | null } | null =
        await this.prisma.folder.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
      cursor = parent?.parentId ?? null;
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    await this.ensureOwner(folder.propertyId, userId);

    if (folder.isSystem) {
      throw new ForbiddenException('System folders cannot be deleted');
    }

    // Child folders cascade (schema); documents inside are detached
    // (Document.folderId onDelete: SetNull) — the files themselves are kept.
    await this.prisma.folder.delete({ where: { id } });
  }
}

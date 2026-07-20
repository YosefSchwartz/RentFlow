import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceAttachmentsService } from './maintenance-attachments.service';
import { DocumentsService } from '../documents/documents.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  MAX_VIDEO_SIZE,
  ATTACHMENT_MIME_TYPE_REGEX,
} from '../media/media-validation';

@Controller()
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly attachmentsService: MaintenanceAttachmentsService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post('properties/:propertyId/requests')
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateMaintenanceRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.create(propertyId, dto, userId);
  }

  @Get('me/requests')
  findMyRequests(@CurrentUser('id') userId: string) {
    return this.maintenanceService.findMyRequests(userId);
  }

  @Get('properties/:propertyId/requests')
  findAllForProperty(
    @Param('propertyId') propertyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.findAllForProperty(propertyId, userId);
  }

  @Get('requests/:id/comments')
  findComments(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.maintenanceService.findComments(id, userId);
  }

  @Post('requests/:id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.addComment(id, dto, userId);
  }

  // Mark a request's conversation as read (records view time + clears its
  // notifications). Called when the user opens the conversation.
  @Post('requests/:id/read')
  markConversationRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.markConversationRead(id, userId);
  }

  // ============================================
  // Attachments (evidence files on a request)
  // ============================================

  @Get('requests/:id/attachments')
  findAttachments(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.attachmentsService.findAllForRequest(id, userId);
  }

  @Post('requests/:id/attachments/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // Coarse guard; per-type limits enforced in the service.
          new MaxFileSizeValidator({ maxSize: MAX_VIDEO_SIZE }),
          new FileTypeValidator({ fileType: ATTACHMENT_MIME_TYPE_REGEX }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.attachmentsService.upload(id, file, userId);
  }

  @Delete('attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAttachment(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attachmentsService.delete(attachmentId, userId);
  }

  // ============================================
  // Receipts (financial documents, RESOLVED requests only)
  // ============================================

  @Get('requests/:id/receipts')
  findReceipts(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.documentsService.findReceiptsForMaintenanceRequest(id, userId);
  }

  @Post('requests/:id/receipts/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadReceipt(
    @Param('id') id: string,
    @Body('name') name: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_VIDEO_SIZE }),
          new FileTypeValidator({ fileType: ATTACHMENT_MIME_TYPE_REGEX }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.uploadMaintenanceReceipt(
      id,
      file,
      name || file.originalname,
      userId,
    );
  }

  @Get('requests/:id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.findOne(id, userId);
  }

  @Patch('requests/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.update(id, dto, userId);
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.maintenanceService.delete(id, userId);
  }
}

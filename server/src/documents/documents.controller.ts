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
import { DocumentsService } from './documents.service';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { GetUploadUrlDto } from './dto/upload-document.dto';
import { RequestDocumentDto } from './dto/request-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DocumentVisibility } from '@prisma/client';

// 10MB max file size
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES =
  /^(image\/(jpeg|png|gif|webp)|application\/pdf|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain)$/;

@Controller()
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('properties/:propertyId/documents')
  findAllForProperty(
    @Param('propertyId') propertyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.findAllForProperty(propertyId, userId);
  }

  @Get('leases/:leaseId/documents')
  findAllForLease(
    @Param('leaseId') leaseId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.findAllForLease(leaseId, userId);
  }

  @Get('documents/:id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.documentsService.findOne(id, userId);
  }

  @Patch('documents/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.update(id, dto, userId);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.documentsService.delete(id, userId);
  }

  // ============================================
  // S3 Upload endpoints
  // ============================================

  /**
   * Get a signed URL for uploading a document to S3
   * Client uploads directly to S3 using the returned URL
   */
  @Post('properties/:propertyId/documents/upload-url')
  getUploadUrl(
    @Param('propertyId') propertyId: string,
    @Body() dto: GetUploadUrlDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.getUploadUrl(propertyId, dto, userId);
  }

  /**
   * Get a signed URL for uploading a lease document to S3
   */
  @Post('leases/:leaseId/documents/upload-url')
  getLeaseUploadUrl(
    @Param('leaseId') leaseId: string,
    @Body() dto: GetUploadUrlDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.getLeaseUploadUrl(leaseId, dto, userId);
  }

  /**
   * Get a signed download URL for a document
   */
  @Get('documents/:id/download-url')
  getDownloadUrl(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.documentsService.getDownloadUrl(id, userId);
  }

  /**
   * Delete a document and its associated file from S3
   */
  @Delete('documents/:id/with-file')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWithFile(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.documentsService.deleteWithFile(id, userId);
  }

  /**
   * Direct file upload (server-side)
   * Use this for smaller files or when client-side upload is not feasible
   */
  @Post('properties/:propertyId/documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('propertyId') propertyId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_MIME_TYPES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('name') name: string,
    @Body('category') category: string,
    @Body('visibility') visibility: DocumentVisibility | undefined,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.uploadDocument(
      propertyId,
      file,
      name,
      category,
      userId,
      visibility,
    );
  }

  /**
   * Direct lease document upload (server-side)
   */
  @Post('leases/:leaseId/documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadLeaseDocument(
    @Param('leaseId') leaseId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_MIME_TYPES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('name') name: string,
    @Body('category') category: string,
    @Body('visibility') visibility: DocumentVisibility | undefined,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.uploadLeaseDocument(
      leaseId,
      file,
      name,
      category,
      userId,
      visibility,
    );
  }

  // ============================================
  // Required Documents workflow
  // ============================================

  /**
   * Landlord requests a document from a tenant (no file yet).
   */
  @Post('leases/:leaseId/documents/request')
  requestDocument(
    @Param('leaseId') leaseId: string,
    @Body() dto: RequestDocumentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.requestDocument(leaseId, dto, userId);
  }

  /**
   * Tenant uploads a file to fulfill a requested document.
   */
  @Post('documents/:id/fulfill')
  @UseInterceptors(FileInterceptor('file'))
  fulfillRequest(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_MIME_TYPES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.fulfillRequest(id, file, userId);
  }

  /**
   * Landlord lists required documents across a property's leases.
   */
  @Get('properties/:propertyId/required-documents')
  findRequiredForProperty(
    @Param('propertyId') propertyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.findRequiredForProperty(propertyId, userId);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  Header,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReceiptsService } from './receipts.service';
import { UploadReceiptDto } from './dto/upload-receipt.dto';
import { ReceiptQueryDto } from './dto/receipt-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  MAX_DOCUMENT_SIZE,
  ATTACHMENT_MIME_TYPE_REGEX,
} from '../media/media-validation';

@Controller('properties/:propertyId/receipts')
@UseGuards(JwtAuthGuard)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  /** Manual receipt upload (landlord). */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadManual(
    @Param('propertyId') propertyId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_DOCUMENT_SIZE }),
          new FileTypeValidator({ fileType: ATTACHMENT_MIME_TYPE_REGEX }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadReceiptDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.receiptsService.uploadManual(propertyId, file, dto, userId);
  }

  /** List receipts, optionally filtered by tax year. */
  @Get()
  list(
    @Param('propertyId') propertyId: string,
    @Query() query: ReceiptQueryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.receiptsService.listForProperty(propertyId, userId, query.year);
  }

  /** Dashboard: receipts grouped by tax year (count + total storage). */
  @Get('summary')
  summary(
    @Param('propertyId') propertyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.receiptsService.summary(propertyId, userId);
  }

  /** Export receipt metadata as CSV. */
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="receipts.csv"')
  exportCsv(
    @Param('propertyId') propertyId: string,
    @Query() query: ReceiptQueryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.receiptsService.exportCsv(propertyId, userId, query.year);
  }

  /** Export receipt files as a ZIP, foldered by tax year. */
  @Get('export.zip')
  exportZip(
    @Param('propertyId') propertyId: string,
    @Query() query: ReceiptQueryDto,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    return this.receiptsService.exportZip(propertyId, userId, query.year, res);
  }
}

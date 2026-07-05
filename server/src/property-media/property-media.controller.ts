import {
  Controller,
  Get,
  Post,
  Delete,
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
import { PropertyMediaService } from './property-media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  MAX_VIDEO_SIZE,
  MEDIA_MIME_TYPE_REGEX,
} from '../media/media-validation';

@Controller()
@UseGuards(JwtAuthGuard)
export class PropertyMediaController {
  constructor(private readonly propertyMediaService: PropertyMediaService) {}

  @Get('properties/:propertyId/media')
  findAllForProperty(
    @Param('propertyId') propertyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.propertyMediaService.findAllForProperty(propertyId, userId);
  }

  @Post('properties/:propertyId/media/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('propertyId') propertyId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // Coarse guard; per-type limits enforced in the service.
          new MaxFileSizeValidator({ maxSize: MAX_VIDEO_SIZE }),
          new FileTypeValidator({ fileType: MEDIA_MIME_TYPE_REGEX }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.propertyMediaService.upload(propertyId, file, userId);
  }

  @Delete('media/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.propertyMediaService.delete(id, userId);
  }
}

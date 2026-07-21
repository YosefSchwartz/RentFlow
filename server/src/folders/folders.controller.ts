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
} from '@nestjs/common';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get('properties/:propertyId/folders')
  findTree(
    @Param('propertyId') propertyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.foldersService.findTreeForProperty(propertyId, userId);
  }

  @Post('properties/:propertyId/folders')
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateFolderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.foldersService.create(propertyId, dto, userId);
  }

  @Patch('folders/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.foldersService.update(id, dto, userId);
  }

  @Delete('folders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.foldersService.delete(id, userId);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { SetAiCategoryDto } from './dto/set-ai-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('documents/:id/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** AI status + summary + prediction + approved category + extracted fields. */
  @Get()
  get(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.aiService.getForDocument(id, userId);
  }

  /** Manual retry — enqueues a fresh analysis job (no scheduling). */
  @Post('retry')
  @HttpCode(HttpStatus.ACCEPTED)
  retry(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.aiService.retry(id, userId);
  }

  /** The user's category decision becomes official; prediction is retained. */
  @Post('category')
  setCategory(
    @Param('id') id: string,
    @Body() dto: SetAiCategoryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.aiService.setCategory(id, dto.category, userId);
  }
}

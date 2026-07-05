import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/me')
  getProfile(@CurrentUser() user: CurrentUserData) {
    return user;
  }

  @Get('me/dashboard')
  getDashboard(@CurrentUser('id') userId: string) {
    return this.usersService.getDashboard(userId);
  }

  // Permanently delete the authenticated user's account and all their data.
  // Requires re-authentication (current password).
  @Post('users/me/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.usersService.deleteAccount(userId, dto.password);
  }
}

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { ProfileService } from './profile.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ProfileService],
  exports: [UsersService, ProfileService],
})
export class UsersModule {}

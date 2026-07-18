import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        // Default expiration, can be overridden in service
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
    // IP-based throttling for OTP-triggering endpoints only (register,
    // resend-otp, forgot-password), applied per-route via
    // @UseGuards(ThrottlerGuard), not globally. In-memory storage: staging
    // actually autoscales 2-6 ECS tasks, so the effective global limit is
    // looser than 5/min per task (roughly 10-30/min) — a shared store would
    // be needed to enforce the limit exactly across replicas.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 5 }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

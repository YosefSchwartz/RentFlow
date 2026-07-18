import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ProfileService } from '../users/profile.service';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  AuthResponse,
  RefreshResponse,
  RegisterResponse,
} from './interfaces/auth-response.interface';
import { EmailNotVerifiedException } from './exceptions/email-not-verified.exception';

@Injectable()
export class AuthService {
  private readonly refreshTokenExpirationDays = 30;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly profileService: ProfileService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    try {
      // This is the user's very first OTP request, so it can never be in
      // cooldown — the code is always generated (never null) here.
      const code = await this.otpService.generate(user.id, OtpPurpose.EMAIL_VERIFICATION, {
        throwOnCooldown: false,
      });
      await this.emailService.sendVerificationOtp(user.email, user.firstName, code as string);
    } catch (error) {
      // Don't leave an unverifiable account behind — email is unique, so a
      // stuck row here would permanently block this address from ever
      // registering again. Cascade-deletes the OtpCode row too.
      this.logger.error(`Failed to send verification email to ${user.email}`, error as Error);
      await this.prisma.user.delete({ where: { id: user.id } });
      throw new ServiceUnavailableException(
        'Could not send verification email. Please try again.',
      );
    }

    return {
      email: user.email,
      message: 'Registration successful. Check your email for a verification code.',
    };
  }

  async login(dto: LoginDto, deviceIdentifier?: string): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new EmailNotVerifiedException(user.email);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createSession(user.id, deviceIdentifier);
  }

  async verifyEmail(dto: VerifyOtpDto, deviceIdentifier?: string): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.otpService.verify(user.id, OtpPurpose.EMAIL_VERIFICATION, dto.code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });

    return this.createSession(user.id, deviceIdentifier);
  }

  async resendVerificationOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.emailVerified) {
      throw new ConflictException('This account is already verified');
    }

    const code = await this.otpService.generate(user.id, OtpPurpose.EMAIL_VERIFICATION, {
      throwOnCooldown: true,
    });
    await this.emailService.sendVerificationOtp(user.email, user.firstName, code as string);

    return { message: 'A new verification code has been sent to your email.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const genericMessage = 'If an account exists for that email, a reset code has been sent.';
    const user = await this.usersService.findByEmail(dto.email);

    // Never reveal whether the email exists — always the same response,
    // whether or not a user was found or a code was actually generated
    // (e.g. still in cooldown from a recent request).
    if (user) {
      const code = await this.otpService.generate(user.id, OtpPurpose.PASSWORD_RESET, {
        throwOnCooldown: false,
      });
      if (code) {
        await this.emailService.sendPasswordResetOtp(user.email, user.firstName, code);
      }
    }

    return { message: genericMessage };
  }

  async resetPassword(dto: ResetPasswordDto, deviceIdentifier?: string): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.otpService.verify(user.id, OtpPurpose.PASSWORD_RESET, dto.code);

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    // Invalidate every existing session — the whole point of a reset is that
    // whoever had the old password (and any of its sessions) shouldn't keep
    // access.
    await this.logoutAll(user.id);
    await this.notificationsService.notifyPasswordChanged(user.id);

    // Hand the device that just completed the reset a fresh session — it
    // already proved ownership via the OTP.
    return this.createSession(user.id, deviceIdentifier);
  }

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    // Find valid session by checking all sessions for this token
    const sessions = await this.prisma.session.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Find the session that matches the refresh token
    let validSession = null;
    for (const session of sessions) {
      const isValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
      if (isValid) {
        validSession = session;
        break;
      }
    }

    if (!validSession) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Generate new tokens (rotation)
    const newRefreshToken = this.generateRefreshToken();
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + this.refreshTokenExpirationDays);

    // Update session with new refresh token
    await this.prisma.session.update({
      where: { id: validSession.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt: newExpiresAt,
      },
    });

    const accessToken = this.generateAccessToken(validSession.user.id, validSession.user.email);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    // Find and delete the session
    const sessions = await this.prisma.session.findMany();

    for (const session of sessions) {
      const isValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
      if (isValid) {
        await this.prisma.session.delete({
          where: { id: session.id },
        });
        return;
      }
    }

    // Silent fail if session not found (already logged out)
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  private async createSession(
    userId: string,
    deviceIdentifier?: string,
  ): Promise<AuthResponse> {
    // Build `user` from the same full profile shape GET /users/me returns
    // (including phone and a freshly-signed avatarUrl) — a slim, hand-built
    // object here previously meant every login/verify/reset overwrote the
    // app's in-memory user with one missing phone/avatarUrl, even though the
    // DB had them (only a later GET /users/me would have restored them).
    const profile = await this.profileService.getProfile(userId);

    const accessToken = this.generateAccessToken(userId, profile.email);
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpirationDays);

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        deviceIdentifier,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        emailVerified: profile.emailVerified,
        phone: profile.phone,
        avatarUrl: profile.avatarUrl,
      },
    };
  }

  private generateAccessToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload, {
      expiresIn: '15m',
    });
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  // Cleanup expired sessions (can be called by a cron job)
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}

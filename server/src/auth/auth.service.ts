import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, RefreshResponse } from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  private readonly refreshTokenExpirationDays = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, deviceIdentifier?: string): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    return this.createSession(user.id, user.email, user.firstName, user.lastName, deviceIdentifier);
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

    return this.createSession(user.id, user.email, user.firstName, user.lastName, deviceIdentifier);
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
    email: string,
    firstName: string,
    lastName: string,
    deviceIdentifier?: string,
  ): Promise<AuthResponse> {
    const accessToken = this.generateAccessToken(userId, email);
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
        id: userId,
        email,
        firstName,
        lastName,
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

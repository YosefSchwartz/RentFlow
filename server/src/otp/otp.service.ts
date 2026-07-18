import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface GenerateOtpOptions {
  /**
   * If true, a resend still within the cooldown window throws a
   * BadRequestException (used by user-triggered resends). If false, a
   * resend within cooldown is silently skipped — no new code is created,
   * generate() returns null — so callers like forgot-password never leak
   * account existence or invite email spam via timing.
   */
  throwOnCooldown: boolean;
}

/**
 * OTP issuance/verification, purpose-agnostic (EMAIL_VERIFICATION,
 * PASSWORD_RESET, and — infrastructure-only for now — EMAIL_CHANGE).
 *
 * Codes are hashed with HMAC-SHA256, not bcrypt: a 6-digit code has only
 * 1,000,000 possibilities, and the real defenses here are expiry + attempt
 * lockout + rate limiting, not hash cost. Bcrypt's deliberate slowness is the
 * right tool for password storage; it buys nothing for a code that's already
 * dead in 10 minutes and locked after 5 wrong guesses, and just burns CPU on
 * every verify.
 */
@Injectable()
export class OtpService {
  private static readonly CODE_LENGTH = 6;
  private static readonly TTL_MS = 10 * 60 * 1000;
  private static readonly RESEND_COOLDOWN_MS = 60 * 1000;
  private static readonly MAX_DAILY_SENDS = 20;
  private static readonly MAX_ATTEMPTS = 5;

  private readonly otpSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.otpSecret = config.get<string>('OTP_SECRET', 'change-me');
  }

  /**
   * Generates and persists a new OTP for userId+purpose, returning the
   * plaintext code (only ever held in memory by the caller, passed straight
   * to EmailService — never logged, never persisted). Returns null if a
   * resend was requested within the cooldown window and throwOnCooldown is
   * false (silent no-op).
   */
  async generate(
    userId: string,
    purpose: OtpPurpose,
    options: GenerateOtpOptions,
  ): Promise<string | null> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await this.prisma.otpCode.count({
      where: { userId, purpose, createdAt: { gt: since24h } },
    });
    if (sentToday >= OtpService.MAX_DAILY_SENDS) {
      throw new HttpException(
        'Too many codes requested today. Please try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const mostRecent = await this.prisma.otpCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (mostRecent) {
      const elapsedMs = Date.now() - mostRecent.createdAt.getTime();
      if (elapsedMs < OtpService.RESEND_COOLDOWN_MS) {
        if (options.throwOnCooldown) {
          const remainingSeconds = Math.ceil(
            (OtpService.RESEND_COOLDOWN_MS - elapsedMs) / 1000,
          );
          throw new BadRequestException(
            `Please wait ${remainingSeconds}s before requesting another code.`,
          );
        }
        return null;
      }
    }

    const code = crypto
      .randomInt(0, 10 ** OtpService.CODE_LENGTH)
      .toString()
      .padStart(OtpService.CODE_LENGTH, '0');

    // Invalidate any still-unconsumed prior codes for this user+purpose —
    // only the code just issued is valid going forward.
    await this.prisma.otpCode.deleteMany({
      where: { userId, purpose, consumedAt: null },
    });

    await this.prisma.otpCode.create({
      data: {
        userId,
        purpose,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + OtpService.TTL_MS),
      },
    });

    return code;
  }

  /** Verifies a code for userId+purpose. Throws BadRequestException on any failure. */
  async verify(
    userId: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }

    if (otp.attempts >= OtpService.MAX_ATTEMPTS) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    if (!this.matches(code, otp.codeHash)) {
      const attempts = otp.attempts + 1;
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: {
          attempts,
          // Lock it on the attempt that hits the cap, so the next verify
          // call fails fast on "too many attempts" instead of "wrong code".
          consumedAt: attempts >= OtpService.MAX_ATTEMPTS ? new Date() : null,
        },
      });
      throw new BadRequestException('Invalid or expired code');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }

  /** Deletes expired codes. Not scheduled by a cron in this MVP — a future maintenance job can call it. */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.otpCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  private hash(code: string): string {
    return crypto.createHmac('sha256', this.otpSecret).update(code).digest('hex');
  }

  private matches(code: string, codeHash: string): boolean {
    const candidate = this.hash(code);
    // Both sides are fixed-length hex digests (64 chars) so the lengths always
    // match — required for timingSafeEqual, which throws on length mismatch.
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(codeHash));
  }
}

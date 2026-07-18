import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Raised by login() when the account's email hasn't been verified yet.
 * Carries a stable `code` field (distinct from statusCode) so the mobile
 * client can detect this specific case and offer a "verify now" action
 * instead of showing a generic error.
 */
export class EmailNotVerifiedException extends HttpException {
  constructor(email: string) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before logging in.',
        email,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

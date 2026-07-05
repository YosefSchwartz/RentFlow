import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Application-level storage errors.
 *
 * The storage provider catches all underlying SDK errors (AWS SDK, etc.) and
 * re-throws one of these, so business code never sees provider-specific
 * exceptions and can rely on a stable, consistent error contract.
 */
export class StorageException extends HttpException {
  constructor(
    message = 'A storage error occurred',
    readonly originalError?: unknown,
  ) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Raised when an object does not exist in the underlying store.
 */
export class StorageObjectNotFoundException extends HttpException {
  constructor(key?: string) {
    super(
      key ? `Stored object not found: ${key}` : 'Stored object not found',
      HttpStatus.NOT_FOUND,
    );
  }
}

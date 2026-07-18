import { IsStrongPassword, IsStrongPasswordOptions } from 'class-validator';

/**
 * Shared password policy — one definition used by both registration and
 * password reset, so the two flows can never drift apart. Backed by
 * class-validator's built-in IsStrongPassword (already a dependency), not a
 * hand-rolled regex.
 */
export const PASSWORD_POLICY: IsStrongPasswordOptions = {
  minLength: 8,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

export function IsPasswordPolicyCompliant() {
  return IsStrongPassword(PASSWORD_POLICY, {
    message:
      'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
  });
}

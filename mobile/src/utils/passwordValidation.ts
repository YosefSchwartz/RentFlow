// Mirrors the backend's password policy exactly (server/src/auth/validators/
// password-policy.ts — class-validator's IsStrongPassword with minLength: 8,
// minLowercase/minUppercase/minNumbers/minSymbols: 1). Shared by
// RegisterScreen and ResetPasswordScreen so the two never drift apart.

const MIN_LENGTH = 8;

// Returns i18n keys for every failed rule (empty array = compliant).
export const validatePassword = (password: string): string[] => {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push('auth.errors.passwordMinLength');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('auth.errors.passwordNeedsLower');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('auth.errors.passwordNeedsUpper');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('auth.errors.passwordNeedsDigit');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('auth.errors.passwordNeedsSpecial');
  }

  return errors;
};

/**
 * Plain template-literal builders — no templating dependency. Shared shape
 * for both OTP purposes (verification now, password reset in Milestone 3)
 * since the only difference is copy.
 */

function otpEmail(firstName: string, code: string, intro: string, footer: string) {
  const text = `Hi ${firstName},\n\n${intro}\n\nYour code: ${code}\n\nThis code expires in 10 minutes.\n\n${footer}`;
  const html = `
    <p>Hi ${firstName},</p>
    <p>${intro}</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
    <p>This code expires in 10 minutes.</p>
    <p>${footer}</p>
  `;
  return { text, html };
}

export function buildVerificationEmail(firstName: string, code: string) {
  return {
    subject: 'Verify your RentFlow email',
    ...otpEmail(
      firstName,
      code,
      'Enter this code in the app to verify your email address.',
      "If you didn't create a RentFlow account, you can ignore this email.",
    ),
  };
}

export function buildPasswordResetEmail(firstName: string, code: string) {
  return {
    subject: 'Reset your RentFlow password',
    ...otpEmail(
      firstName,
      code,
      'Enter this code in the app to reset your password.',
      "If you didn't request a password reset, you can ignore this email.",
    ),
  };
}

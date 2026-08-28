export const CONTACT_VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'REVOKED'] as const;
export type ContactVerificationStatus = (typeof CONTACT_VERIFICATION_STATUSES)[number];

export const SESSION_AUTH_STRENGTHS = ['VERIFIED_CONTACT', 'PASSKEY', 'STEP_UP'] as const;
export type SessionAuthStrength = (typeof SESSION_AUTH_STRENGTHS)[number];

export function normaliseVerificationCode(raw: string): string {
  const code = raw.trim();
  if (!/^\d{6}$/.test(code)) throw new Error('Verification code must be exactly six digits');
  return code;
}

export function canAttemptContactVerification(
  status: ContactVerificationStatus,
  expiresAt: Date,
  attemptCount: number,
  maxAttempts: number,
  now: Date = new Date()
): boolean {
  return status === 'PENDING' && expiresAt.getTime() > now.getTime() && attemptCount < maxAttempts;
}

export function shouldExpireContactVerification(
  status: ContactVerificationStatus,
  expiresAt: Date,
  now: Date = new Date()
): boolean {
  return status === 'PENDING' && expiresAt.getTime() <= now.getTime();
}

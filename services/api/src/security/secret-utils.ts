import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function issueOpaqueSecret(prefix: string): { bearerSecret: string; persistedHash: string } {
  const bearerSecret = `${prefix}_${randomBytes(32).toString('base64url')}`;
  return { bearerSecret, persistedHash: hashOpaqueSecret(bearerSecret) };
}

export function hashOpaqueSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function createVerificationSalt(): string {
  return randomBytes(16).toString('base64url');
}

export function hashVerificationCode(
  pepper: string,
  verificationId: string,
  salt: string,
  code: string
): string {
  return createHmac('sha256', pepper)
    .update(`${verificationId}:${salt}:${code}`, 'utf8')
    .digest('hex');
}

export function constantTimeHexEqual(expectedHex: string, actualHex: string): boolean {
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(actualHex, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

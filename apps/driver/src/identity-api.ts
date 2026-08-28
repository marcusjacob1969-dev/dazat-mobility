import type {
  AccountRegistrationResult,
  AuthenticatedSessionResult,
  ConfirmContactVerificationRequest,
  StartAccountRegistrationRequest,
  StartContactVerificationResult
} from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function requireJson<T>(response: Response, message: string): Promise<T> {
  if (!response.ok) throw new Error(message);
  return response.json() as Promise<T>;
}

export async function startDriverRegistration(request: StartAccountRegistrationRequest): Promise<AccountRegistrationResult> {
  const response = await fetch(`${API_BASE_URL}/v1/identity/registrations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': requestKey('driver-registration') },
    body: JSON.stringify(request)
  });
  return requireJson<AccountRegistrationResult>(response, 'Registration is unavailable right now.');
}

export async function startDriverContactVerification(accountId: string, contactPointId: string): Promise<StartContactVerificationResult> {
  const response = await fetch(`${API_BASE_URL}/v1/identity/verifications/contact`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId, contactPointId })
  });
  return requireJson<StartContactVerificationResult>(response, 'Verification code could not be requested.');
}

export async function confirmDriverContactVerification(request: ConfirmContactVerificationRequest): Promise<AuthenticatedSessionResult> {
  const response = await fetch(`${API_BASE_URL}/v1/identity/verifications/contact/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request)
  });
  return requireJson<AuthenticatedSessionResult>(response, 'Verification could not be completed.');
}

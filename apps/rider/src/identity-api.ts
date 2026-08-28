import type { AccountRegistrationResult, StartAccountRegistrationRequest } from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

export async function startRiderRegistration(
  request: StartAccountRegistrationRequest
): Promise<AccountRegistrationResult> {
  const idempotencyKey = `rider-registration-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await fetch(`${API_BASE_URL}/v1/identity/registrations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) throw new Error('Registration is unavailable right now.');
  return response.json() as Promise<AccountRegistrationResult>;
}

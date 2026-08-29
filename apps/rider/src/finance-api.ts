import type { PaymentStatusProjection, PreparePaymentIntentResult, ReceiptProjection } from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string; message?: string };
  if (!response.ok) throw new Error(`${body.code ?? 'FINANCE_REQUEST_FAILED'}${body.message ? `: ${body.message}` : ''}`);
  return body;
}

function auth(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

export async function prepareProviderDisabledPaymentIntent(
  sessionToken: string,
  bookingId: string
): Promise<PreparePaymentIntentResult> {
  return json(await fetch(`${API_BASE_URL}/v1/bookings/${bookingId}/payment-intents`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'idempotency-key': requestKey('prepare-payment-intent') }
  }));
}

export async function readPaymentStatus(sessionToken: string, paymentIntentId: string): Promise<PaymentStatusProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/payments/${paymentIntentId}/status`, { headers: auth(sessionToken) }));
}

export async function readReceipt(sessionToken: string, bookingId: string): Promise<ReceiptProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/receipts/${bookingId}`, { headers: auth(sessionToken) }));
}

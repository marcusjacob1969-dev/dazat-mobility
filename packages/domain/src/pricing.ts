export const QUOTE_STATUSES = ['OFFERED', 'ACCEPTED', 'EXPIRED', 'SUPERSEDED', 'CANCELLED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export function assertCurrencyCode(currency: string): string {
  const value = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) throw new Error('Currency must be an ISO-style three-letter code');
  return value;
}

export function assertMoneyMinorUnits(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error('Money amount must be a non-negative safe integer in minor units');
  }
  return amountMinor;
}

export function isQuoteUsable(status: QuoteStatus, expiresAt: Date, now: Date = new Date()): boolean {
  return status === 'OFFERED' && expiresAt.getTime() > now.getTime();
}

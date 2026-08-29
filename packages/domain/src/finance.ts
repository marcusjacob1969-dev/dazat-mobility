import { assertCurrencyCode } from './pricing.js';

export const PAYMENT_STATUSES = [
  'CREATED',
  'PROCESSING',
  'REQUIRES_ACTION',
  'AUTHORISED',
  'CAPTURED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'VOIDED',
  'EXPIRED',
  'STATUS_UNKNOWN',
  'DISPUTED',
  'CHARGEBACK'
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const paymentTransitions: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  CREATED: ['PROCESSING', 'EXPIRED', 'VOIDED'],
  PROCESSING: ['REQUIRES_ACTION', 'AUTHORISED', 'FAILED', 'STATUS_UNKNOWN'],
  REQUIRES_ACTION: ['PROCESSING', 'AUTHORISED', 'FAILED', 'EXPIRED', 'STATUS_UNKNOWN'],
  AUTHORISED: ['CAPTURED', 'VOIDED', 'STATUS_UNKNOWN'],
  CAPTURED: ['PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'CHARGEBACK'],
  PARTIALLY_REFUNDED: ['PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'CHARGEBACK'],
  REFUNDED: ['DISPUTED', 'CHARGEBACK'],
  FAILED: [],
  VOIDED: [],
  EXPIRED: [],
  STATUS_UNKNOWN: ['REQUIRES_ACTION', 'AUTHORISED', 'CAPTURED', 'FAILED', 'VOIDED'],
  DISPUTED: ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK'],
  CHARGEBACK: []
};

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  return paymentTransitions[from].includes(to);
}

export function assertPaymentStatusTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPaymentStatus(from, to)) throw new Error(`Invalid Payment transition ${from} -> ${to}`);
}

export interface ProviderTimeoutDecision {
  readonly status: 'STATUS_UNKNOWN';
  readonly reconciliationRequired: true;
  readonly blindRetryAllowed: false;
}

export function paymentProviderTimeoutDecision(): ProviderTimeoutDecision {
  return { status: 'STATUS_UNKNOWN', reconciliationRequired: true, blindRetryAllowed: false };
}

export function canBlindRetryPaymentAction(status: PaymentStatus): boolean {
  return status === 'CREATED' || status === 'REQUIRES_ACTION';
}

export type LedgerDirection = 'DEBIT' | 'CREDIT';

export interface LedgerEntryInput {
  readonly accountId: string;
  readonly direction: LedgerDirection;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface LedgerBalanceDecision {
  readonly balanced: boolean;
  readonly currency: string;
  readonly debitMinor: bigint;
  readonly creditMinor: bigint;
}

export function evaluateBalancedLedger(entries: readonly LedgerEntryInput[]): LedgerBalanceDecision {
  if (entries.length < 2) throw new Error('A ledger transaction requires at least two entries');
  const currency = entries[0]!.currency.toUpperCase();
  assertCurrencyCode(currency);
  let debitMinor = 0n;
  let creditMinor = 0n;
  for (const entry of entries) {
    if (!entry.accountId.trim()) throw new Error('Ledger account is required');
    if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor <= 0) {
      throw new Error('Ledger amounts must be positive integer minor units');
    }
    if (entry.currency.toUpperCase() !== currency) throw new Error('A ledger transaction must use one currency');
    if (entry.direction === 'DEBIT') debitMinor += BigInt(entry.amountMinor);
    else if (entry.direction === 'CREDIT') creditMinor += BigInt(entry.amountMinor);
    else throw new Error('Invalid ledger direction');
  }
  return { balanced: debitMinor === creditMinor, currency, debitMinor, creditMinor };
}

export function assertBalancedLedger(entries: readonly LedgerEntryInput[]): void {
  const decision = evaluateBalancedLedger(entries);
  if (!decision.balanced) throw new Error('Ledger transaction is not balanced');
}

export function reverseLedgerEntries(entries: readonly LedgerEntryInput[]): readonly LedgerEntryInput[] {
  return entries.map((entry) => ({
    ...entry,
    direction: entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT'
  }));
}

const forbiddenPaymentSecretKeys = new Set([
  'pan', 'cardnumber', 'fullcardnumber', 'cvv', 'cvc', 'securitycode', 'trackdata', 'pin', 'pinblock'
]);

export function assertNoRawPaymentSecrets(value: unknown, path = 'payload'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawPaymentSecrets(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const canonical = key.replace(/[_-]/g, '').toLowerCase();
    if (forbiddenPaymentSecretKeys.has(canonical)) throw new Error(`Raw payment secret field is forbidden at ${path}.${key}`);
    assertNoRawPaymentSecrets(nested, `${path}.${key}`);
  }
}

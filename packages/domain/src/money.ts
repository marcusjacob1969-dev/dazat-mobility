export interface Money {
  /** Integer minor units only; never binary floating-point money. */
  readonly minorUnits: number;
  /** ISO 4217 currency code, e.g. GBP. */
  readonly currency: string;
}

export function money(minorUnits: number, currency: string): Money {
  if (!Number.isSafeInteger(minorUnits)) throw new Error('Money minorUnits must be a safe integer');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Money currency must be an ISO-style 3-letter uppercase code');
  return Object.freeze({ minorUnits, currency });
}

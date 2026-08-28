import { assertCurrencyCode, assertMoneyMinorUnits } from '@dazat/domain';

export interface QuotePricingInput {
  readonly bookingId: string;
  readonly regionCode: string;
  readonly scheduledFor?: Date;
}

export interface PricedQuote {
  readonly amountMinor: number;
  readonly currency: string;
  readonly policyVersion: string;
  readonly sourceMode: string;
  readonly expiresAt: Date;
  readonly nonCommercialDevelopmentFixture: boolean;
}

export interface PricingPort {
  createQuote(input: QuotePricingInput): Promise<PricedQuote>;
}

export class PricingNotConfiguredError extends Error {}

export class DisabledPricingAdapter implements PricingPort {
  async createQuote(): Promise<PricedQuote> {
    throw new PricingNotConfiguredError('Production pricing policy is not configured');
  }
}

export class DevelopmentFixturePricingAdapter implements PricingPort {
  private readonly amountMinor: number;
  private readonly currency: string;

  public constructor(amountMinor: number, currency: string, private readonly ttlMinutes: number) {
    this.amountMinor = assertMoneyMinorUnits(amountMinor);
    this.currency = assertCurrencyCode(currency);
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 120) {
      throw new Error('Development quote TTL must be between 1 and 120 minutes');
    }
  }

  async createQuote(): Promise<PricedQuote> {
    return {
      amountMinor: this.amountMinor,
      currency: this.currency,
      policyVersion: 'DEVELOPMENT_FIXTURE_V0.3_NON_COMMERCIAL',
      sourceMode: 'DEVELOPMENT_FIXTURE',
      expiresAt: new Date(Date.now() + this.ttlMinutes * 60_000),
      nonCommercialDevelopmentFixture: true
    };
  }
}

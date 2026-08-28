export const BOOKING_PARTY_ROLES = [
  'BOOKER',
  'PASSENGER',
  'PAYER',
  'GUARDIAN',
  'AUTHORISED_CONTACT',
  'ORGANISATION'
] as const;

export type BookingPartyRole = typeof BOOKING_PARTY_ROLES[number];

export interface LocationInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly displayLabel: string;
  readonly structuredAddress?: Readonly<Record<string, string>>;
  readonly providerReference?: string;
}

export interface BookingPartyInput {
  readonly role: BookingPartyRole;
  readonly personId?: string;
  readonly organisationId?: string;
}

export interface BookingRequirementInput {
  readonly type: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly source: 'RIDER_PROFILE' | 'BOOKER' | 'OPERATOR' | 'ORGANISATION_POLICY' | 'SYSTEM';
}

export interface CreateBookingCommand {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly regionCode: string;
  readonly pickup: LocationInput;
  readonly dropoff: LocationInput;
  readonly scheduledFor?: string;
  readonly parties: readonly BookingPartyInput[];
  readonly requirements: readonly BookingRequirementInput[];
}

export interface RiderBookingRequirementInput {
  readonly type: string;
  readonly value: Readonly<Record<string, unknown>>;
}

export interface CreateRiderBookingRequest {
  readonly regionCode: string;
  readonly pickup: LocationInput;
  readonly dropoff: LocationInput;
  readonly scheduledFor?: string;
  readonly requirements?: readonly RiderBookingRequirementInput[];
}

export interface BookingSummary {
  readonly bookingId: string;
  readonly status: string;
  readonly aggregateVersion: number;
  readonly regionCode: string;
  readonly scheduledFor?: string;
  readonly pickup: LocationInput;
  readonly dropoff: LocationInput;
}

export interface BookingQuoteResult {
  readonly booking: BookingSummary;
  readonly quote: {
    readonly quoteId: string;
    readonly status: 'OFFERED';
    readonly amountMinor: number;
    readonly currency: string;
    readonly policyVersion: string;
    readonly expiresAt: string;
    readonly nonCommercialDevelopmentFixture: boolean;
  };
}

export interface ConfirmBookingRequest {
  readonly quoteId: string;
}

export interface ConfirmBookingResult {
  readonly booking: BookingSummary;
  readonly fareAgreement: {
    readonly fareAgreementId: string;
    readonly quoteId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly policyVersion: string;
    readonly agreedAt: string;
  };
}

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

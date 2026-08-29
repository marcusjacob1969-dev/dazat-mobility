export type PaymentProjectionStatus =
  | 'CREATED'
  | 'PROCESSING'
  | 'REQUIRES_ACTION'
  | 'AUTHORISED'
  | 'CAPTURED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'FAILED'
  | 'VOIDED'
  | 'EXPIRED'
  | 'STATUS_UNKNOWN'
  | 'DISPUTED'
  | 'CHARGEBACK';

export interface PreparePaymentIntentResult {
  readonly paymentIntentId: string;
  readonly bookingId: string;
  readonly fareAgreementId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: 'CREATED';
  readonly chargingEligibility: 'NOT_ELIGIBLE';
  readonly providerActionAttempted: false;
  readonly productionChargingEnabled: false;
  readonly nextAction: 'PROVIDER_CONFIGURATION_REQUIRED';
  readonly blindRetryAllowed: false;
  readonly createdAt: string;
}

export interface PaymentStatusProjection {
  readonly paymentIntentId: string;
  readonly bookingId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: PaymentProjectionStatus;
  readonly chargingEligibility: 'NOT_ELIGIBLE' | 'APPROVED_POLICY';
  readonly productionChargingEnabled: false;
  readonly providerActionAttempted: boolean;
  readonly reconciliationRequired: boolean;
  readonly blindRetryAllowed: boolean;
  readonly guidance: string;
  readonly updatedAt: string;
}

export interface ReceiptProjection {
  readonly receiptId: string;
  readonly bookingId: string;
  readonly paymentId: string;
  readonly capturedAmountMinor: number;
  readonly refundedAmountMinor: number;
  readonly currency: string;
  readonly capturedAt: string;
}

export interface DriverEarningProjection {
  readonly driverEarningId: string;
  readonly bookingId: string;
  readonly journeyId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: 'POSTED' | 'ADJUSTED' | 'REVERSED';
  readonly postedAt: string;
}

export interface DriverEarningsProjection {
  readonly earnings: readonly DriverEarningProjection[];
  readonly payoutDerivedFromEarnings: false;
  readonly riderFareUsedAsDriverEarning: false;
}

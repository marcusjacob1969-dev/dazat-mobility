export interface FleetMarketplaceOfferProjection {
  readonly offerId: string;
  readonly offerFamilyId: string;
  readonly version: number;
  readonly vehicleId: string;
  readonly regionCode: string;
  readonly accessRoute: 'DRIVER_OWNED' | 'WEEKLY_RENT' | 'RENT_TO_OWN' | 'FIXED_TERM_LEASE' | 'LEASE_TO_OWN';
  readonly tier: 'LATEST_MODEL_NEW' | 'BRAND_NEW_OUTGOING_MODEL_YEAR' | 'DAZAT_APPROVED_USED' | 'DRIVER_OWNED';
  readonly periodicChargeMinor: number;
  readonly totalContractCostMinor: number;
  readonly depositMinor: number;
  readonly currency: string;
  readonly billingInterval: 'WEEKLY' | 'MONTHLY' | 'NOT_APPLICABLE';
  readonly termDays?: number;
  readonly mileageTerms: Readonly<Record<string, unknown>>;
  readonly endOfTermConditions: readonly string[];
  readonly includedServices: readonly string[];
  readonly excludedServices: readonly string[];
  readonly ownershipTransferTerms?: readonly string[];
  readonly supplierTermsVerifiedAt: string;
  readonly genericDiscountClaim: false;
}

export interface FleetAgreementProjection {
  readonly agreementId: string;
  readonly agreementVersionId: string;
  readonly version: number;
  readonly vehicleId: string;
  readonly accessRoute: FleetMarketplaceOfferProjection['accessRoute'];
  readonly status: 'PROPOSED' | 'ACCEPTED' | 'ACTIVE' | 'SUSPENDED' | 'ENDED' | 'CANCELLED';
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly depositIsPlatformRevenue: false;
}

export interface VehicleAssignmentValidationProjection {
  readonly driverProfileId: string;
  readonly vehicleId: string;
  readonly replacementForAssignmentId?: string;
  readonly assignable: boolean;
  readonly blockers: readonly string[];
  readonly pairInsuranceCurrent: boolean;
  readonly capabilitiesExplicit: boolean;
  readonly externalFleetOrganisation: boolean;
  readonly externalFleetOrganisationActive: boolean;
  readonly externalTenancyBypassAllowed: false;
  readonly replacementRequiresFreshValidation: true;
  readonly source: 'AUTHORITATIVE_CURRENT_PROJECTION';
  readonly evaluatedAt: string;
}

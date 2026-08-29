export const VEHICLE_ACCESS_ROUTES = [
  'DRIVER_OWNED', 'WEEKLY_RENT', 'RENT_TO_OWN', 'FIXED_TERM_LEASE', 'LEASE_TO_OWN'
] as const;
export type VehicleAccessRoute = (typeof VEHICLE_ACCESS_ROUTES)[number];

export const FLEET_TIERS = [
  'LATEST_MODEL_NEW', 'BRAND_NEW_OUTGOING_MODEL_YEAR', 'DAZAT_APPROVED_USED', 'DRIVER_OWNED'
] as const;
export type FleetTier = (typeof FLEET_TIERS)[number];

export const FLEET_VEHICLE_STATES = [
  'AVAILABLE', 'RESERVED', 'ASSIGNED', 'IN_SERVICE', 'MAINTENANCE', 'REPAIR',
  'QUARANTINED', 'AWAITING_INSPECTION', 'RETURN_PENDING', 'RETIRED'
] as const;
export type FleetVehicleState = (typeof FLEET_VEHICLE_STATES)[number];

const fleetStateTransitions: Readonly<Record<FleetVehicleState, readonly FleetVehicleState[]>> = {
  AVAILABLE: ['RESERVED', 'ASSIGNED', 'MAINTENANCE', 'REPAIR', 'QUARANTINED', 'AWAITING_INSPECTION', 'RETIRED'],
  RESERVED: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'QUARANTINED', 'RETIRED'],
  ASSIGNED: ['IN_SERVICE', 'RETURN_PENDING', 'MAINTENANCE', 'REPAIR', 'QUARANTINED'],
  IN_SERVICE: ['RETURN_PENDING', 'MAINTENANCE', 'REPAIR', 'QUARANTINED'],
  MAINTENANCE: ['AVAILABLE', 'REPAIR', 'QUARANTINED', 'AWAITING_INSPECTION', 'RETIRED'],
  REPAIR: ['AWAITING_INSPECTION', 'QUARANTINED', 'RETIRED'],
  QUARANTINED: ['AWAITING_INSPECTION', 'REPAIR', 'RETIRED'],
  AWAITING_INSPECTION: ['AVAILABLE', 'MAINTENANCE', 'REPAIR', 'QUARANTINED', 'RETIRED'],
  RETURN_PENDING: ['MAINTENANCE', 'REPAIR', 'QUARANTINED', 'AWAITING_INSPECTION', 'RETIRED'],
  RETIRED: []
};

export function canTransitionFleetVehicleState(from: FleetVehicleState, to: FleetVehicleState): boolean {
  return fleetStateTransitions[from].includes(to);
}

export interface MarketplacePublicationInput {
  readonly accessRoute: VehicleAccessRoute;
  readonly tier: FleetTier;
  readonly periodicChargeMinor: number;
  readonly totalContractCostMinor: number;
  readonly depositMinor: number;
  readonly currency: string;
  readonly termDays: number | null;
  readonly mileageTermsExplicit: boolean;
  readonly endOfTermConditionsExplicit: boolean;
  readonly includedServicesExplicit: boolean;
  readonly excludedServicesExplicit: boolean;
  readonly ownershipTransferTermsExplicit: boolean;
  readonly supplierStockVerified: boolean;
  readonly warrantyTermsVerified: boolean;
}

export interface MarketplacePublicationDecision {
  readonly publishable: boolean;
  readonly blockers: readonly string[];
  readonly genericDiscountClaimAllowed: false;
}

export function evaluateMarketplacePublication(input: MarketplacePublicationInput): MarketplacePublicationDecision {
  const blockers: string[] = [];
  const money = [input.periodicChargeMinor, input.totalContractCostMinor, input.depositMinor];
  if (money.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) blockers.push('INVALID_MINOR_UNIT_AMOUNT');
  if (!/^[A-Z]{3}$/.test(input.currency)) blockers.push('INVALID_CURRENCY');
  if ((input.accessRoute === 'DRIVER_OWNED') !== (input.tier === 'DRIVER_OWNED')) blockers.push('ACCESS_ROUTE_TIER_MISMATCH');
  if (input.accessRoute !== 'DRIVER_OWNED') {
    if (input.periodicChargeMinor <= 0) blockers.push('PERIODIC_CHARGE_REQUIRED');
    if (input.totalContractCostMinor <= 0) blockers.push('TOTAL_CONTRACT_COST_REQUIRED');
    if (!input.termDays || !Number.isInteger(input.termDays) || input.termDays <= 0) blockers.push('TERM_REQUIRED');
  }
  if (!input.mileageTermsExplicit) blockers.push('MILEAGE_TERMS_REQUIRED');
  if (!input.endOfTermConditionsExplicit) blockers.push('END_OF_TERM_CONDITIONS_REQUIRED');
  if (!input.includedServicesExplicit || !input.excludedServicesExplicit) blockers.push('SERVICE_INCLUSIONS_EXCLUSIONS_REQUIRED');
  if (['RENT_TO_OWN', 'LEASE_TO_OWN'].includes(input.accessRoute) && !input.ownershipTransferTermsExplicit) {
    blockers.push('OWNERSHIP_TRANSFER_TERMS_REQUIRED');
  }
  if (!input.supplierStockVerified) blockers.push('SUPPLIER_STOCK_NOT_VERIFIED');
  if (!input.warrantyTermsVerified) blockers.push('WARRANTY_TERMS_NOT_VERIFIED');
  return { publishable: blockers.length === 0, blockers, genericDiscountClaimAllowed: false };
}

export interface VehicleCapabilityInput {
  readonly passengerCapacity: number;
  readonly luggageCapacity: number;
  readonly wavCapable: boolean;
  readonly schoolCapable: boolean;
  readonly executiveCapable: boolean;
  readonly airportCapable: boolean;
  readonly evidenceReferences: readonly string[];
  readonly verifiedByAuthority: boolean;
}

export function vehicleCapabilitiesAreExplicitAndVerified(input: VehicleCapabilityInput): boolean {
  return Number.isInteger(input.passengerCapacity) && input.passengerCapacity > 0
    && Number.isInteger(input.luggageCapacity) && input.luggageCapacity >= 0
    && input.evidenceReferences.length > 0
    && input.evidenceReferences.every((value) => value.trim().length > 0)
    && input.verifiedByAuthority;
}

export function depositDeductionMayAdvance(input: {
  readonly amountMinor: number;
  readonly heldDepositMinor: number;
  readonly conditionEvidenceReferences: readonly string[];
  readonly agreementBasisReference: string | null;
  readonly disputeRouteProvided: boolean;
}): boolean {
  return Number.isSafeInteger(input.amountMinor) && input.amountMinor > 0
    && Number.isSafeInteger(input.heldDepositMinor) && input.heldDepositMinor >= input.amountMinor
    && input.conditionEvidenceReferences.length > 0
    && input.conditionEvidenceReferences.every((value) => value.trim().length > 0)
    && Boolean(input.agreementBasisReference?.trim())
    && input.disputeRouteProvided;
}

export interface VehicleAssignmentPermissionInput {
  readonly driverOperatingEligible: boolean;
  readonly driverVehicleAuthorised: boolean;
  readonly pairInsuranceCurrent: boolean;
  readonly vehicleEligible: boolean;
  readonly fleetState: FleetVehicleState;
  readonly agreementActive: boolean;
  readonly validationCurrent: boolean;
  readonly externalFleetOrganisation: boolean;
  readonly externalFleetOrganisationActive: boolean;
  readonly capabilitiesExplicitAndCurrent: boolean;
}

export interface VehicleAssignmentPermissionDecision {
  readonly assignable: boolean;
  readonly blockers: readonly string[];
  readonly externalTenancyBypassAllowed: false;
  readonly replacementRequiresFreshValidation: true;
}

export function evaluateVehicleAssignmentPermission(
  input: VehicleAssignmentPermissionInput
): VehicleAssignmentPermissionDecision {
  const blockers: string[] = [];
  if (!input.driverOperatingEligible) blockers.push('DRIVER_OPERATING_ELIGIBILITY_REQUIRED');
  if (!input.driverVehicleAuthorised) blockers.push('DRIVER_VEHICLE_AUTHORISATION_REQUIRED');
  if (!input.pairInsuranceCurrent) blockers.push('DRIVER_VEHICLE_INSURANCE_NOT_CURRENT');
  if (!input.vehicleEligible) blockers.push('VEHICLE_NOT_ELIGIBLE');
  if (!input.capabilitiesExplicitAndCurrent) blockers.push('VEHICLE_CAPABILITIES_NOT_EXPLICIT_OR_CURRENT');
  if (!['AVAILABLE', 'RESERVED', 'ASSIGNED'].includes(input.fleetState)) blockers.push('FLEET_STATE_NOT_ASSIGNABLE');
  if (!input.agreementActive) blockers.push('ACTIVE_FLEET_AGREEMENT_REQUIRED');
  if (!input.validationCurrent) blockers.push('FRESH_ASSIGNMENT_VALIDATION_REQUIRED');
  if (input.externalFleetOrganisation && !input.externalFleetOrganisationActive) {
    blockers.push('EXTERNAL_FLEET_ORGANISATION_NOT_ACTIVE');
  }
  return {
    assignable: blockers.length === 0,
    blockers,
    externalTenancyBypassAllowed: false,
    replacementRequiresFreshValidation: true
  };
}

export const VEHICLE_CAPABILITY_MAY_BE_INFERRED_FROM_BODY_STYLE = false as const;
export const GENERIC_FLEET_DISCOUNT_CLAIM_ALLOWED = false as const;

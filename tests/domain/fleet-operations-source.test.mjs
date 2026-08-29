import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.endsWith('.ts')) {
      const sourceUrl = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(sourceUrl))) return { url: sourceUrl.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});

const {
  GENERIC_FLEET_DISCOUNT_CLAIM_ALLOWED,
  VEHICLE_CAPABILITY_MAY_BE_INFERRED_FROM_BODY_STYLE,
  canTransitionFleetVehicleState,
  depositDeductionMayAdvance,
  evaluateMarketplacePublication,
  evaluateVehicleAssignmentPermission,
  vehicleCapabilitiesAreExplicitAndVerified
} = await import('../../packages/domain/src/fleet-operations.ts');

function publishableOffer(overrides = {}) {
  return {
    accessRoute: 'WEEKLY_RENT',
    tier: 'DAZAT_APPROVED_USED',
    periodicChargeMinor: 25000,
    totalContractCostMinor: 1300000,
    depositMinor: 50000,
    currency: 'GBP',
    termDays: 365,
    mileageTermsExplicit: true,
    endOfTermConditionsExplicit: true,
    includedServicesExplicit: true,
    excludedServicesExplicit: true,
    ownershipTransferTermsExplicit: false,
    supplierStockVerified: true,
    warrantyTermsVerified: true,
    ...overrides
  };
}

function assignableInput(overrides = {}) {
  return {
    driverOperatingEligible: true,
    driverVehicleAuthorised: true,
    pairInsuranceCurrent: true,
    vehicleEligible: true,
    fleetState: 'AVAILABLE',
    agreementActive: true,
    validationCurrent: true,
    externalFleetOrganisation: false,
    externalFleetOrganisationActive: true,
    capabilitiesExplicitAndCurrent: true,
    ...overrides
  };
}

test('FleetVehicle state transitions reject commercial shortcuts and retirement reversal', () => {
  assert.equal(canTransitionFleetVehicleState('AVAILABLE', 'ASSIGNED'), true);
  assert.equal(canTransitionFleetVehicleState('ASSIGNED', 'AVAILABLE'), false);
  assert.equal(canTransitionFleetVehicleState('MAINTENANCE', 'ASSIGNED'), false);
  assert.equal(canTransitionFleetVehicleState('AWAITING_INSPECTION', 'ASSIGNED'), false);
  assert.equal(canTransitionFleetVehicleState('RETURN_PENDING', 'AVAILABLE'), false);
  assert.equal(canTransitionFleetVehicleState('REPAIR', 'AWAITING_INSPECTION'), true);
  assert.equal(canTransitionFleetVehicleState('RETIRED', 'AVAILABLE'), false);
});

test('Marketplace publication requires complete verified commercial truth', () => {
  const valid = evaluateMarketplacePublication(publishableOffer());
  assert.equal(valid.publishable, true);
  assert.equal(valid.genericDiscountClaimAllowed, false);
  const missing = evaluateMarketplacePublication(publishableOffer({
    totalContractCostMinor: 0,
    supplierStockVerified: false,
    warrantyTermsVerified: false,
    mileageTermsExplicit: false
  }));
  assert.equal(missing.publishable, false);
  assert.ok(missing.blockers.includes('TOTAL_CONTRACT_COST_REQUIRED'));
  assert.ok(missing.blockers.includes('SUPPLIER_STOCK_NOT_VERIFIED'));
  assert.ok(missing.blockers.includes('WARRANTY_TERMS_NOT_VERIFIED'));
  assert.ok(missing.blockers.includes('MILEAGE_TERMS_REQUIRED'));
});

test('rent-to-own and lease-to-own require ownership-transfer terms', () => {
  const blocked = evaluateMarketplacePublication(publishableOffer({ accessRoute: 'RENT_TO_OWN' }));
  assert.ok(blocked.blockers.includes('OWNERSHIP_TRANSFER_TERMS_REQUIRED'));
  assert.equal(evaluateMarketplacePublication(publishableOffer({
    accessRoute: 'LEASE_TO_OWN', ownershipTransferTermsExplicit: true
  })).publishable, true);
  assert.ok(evaluateMarketplacePublication(publishableOffer({ tier: 'DRIVER_OWNED' }))
    .blockers.includes('ACCESS_ROUTE_TIER_MISMATCH'));
});

test('vehicle capabilities require explicit authority and evidence, never body-style inference', () => {
  assert.equal(VEHICLE_CAPABILITY_MAY_BE_INFERRED_FROM_BODY_STYLE, false);
  assert.equal(vehicleCapabilitiesAreExplicitAndVerified({
    passengerCapacity: 4,
    luggageCapacity: 2,
    wavCapable: false,
    schoolCapable: true,
    executiveCapable: false,
    airportCapable: true,
    evidenceReferences: ['inspection-1'],
    verifiedByAuthority: true
  }), true);
  assert.equal(vehicleCapabilitiesAreExplicitAndVerified({
    passengerCapacity: 4,
    luggageCapacity: 2,
    wavCapable: true,
    schoolCapable: true,
    executiveCapable: true,
    airportCapable: true,
    evidenceReferences: [],
    verifiedByAuthority: true
  }), false);
});

test('deposit deduction cannot advance without evidence, agreement basis and dispute route', () => {
  assert.equal(depositDeductionMayAdvance({
    amountMinor: 10000,
    heldDepositMinor: 50000,
    conditionEvidenceReferences: ['handover-photo-set'],
    agreementBasisReference: 'agreement-clause-7',
    disputeRouteProvided: true
  }), true);
  assert.equal(depositDeductionMayAdvance({
    amountMinor: 60000,
    heldDepositMinor: 50000,
    conditionEvidenceReferences: [],
    agreementBasisReference: null,
    disputeRouteProvided: false
  }), false);
});

test('every independent assignment hard check can block', () => {
  assert.equal(evaluateVehicleAssignmentPermission(assignableInput()).assignable, true);
  for (const [override, blocker] of [
    [{ driverOperatingEligible: false }, 'DRIVER_OPERATING_ELIGIBILITY_REQUIRED'],
    [{ driverVehicleAuthorised: false }, 'DRIVER_VEHICLE_AUTHORISATION_REQUIRED'],
    [{ pairInsuranceCurrent: false }, 'DRIVER_VEHICLE_INSURANCE_NOT_CURRENT'],
    [{ vehicleEligible: false }, 'VEHICLE_NOT_ELIGIBLE'],
    [{ capabilitiesExplicitAndCurrent: false }, 'VEHICLE_CAPABILITIES_NOT_EXPLICIT_OR_CURRENT'],
    [{ fleetState: 'QUARANTINED' }, 'FLEET_STATE_NOT_ASSIGNABLE'],
    [{ agreementActive: false }, 'ACTIVE_FLEET_AGREEMENT_REQUIRED'],
    [{ validationCurrent: false }, 'FRESH_ASSIGNMENT_VALIDATION_REQUIRED']
  ]) {
    const decision = evaluateVehicleAssignmentPermission(assignableInput(override));
    assert.equal(decision.assignable, false);
    assert.ok(decision.blockers.includes(blocker));
  }
});

test('external tenancy never bypasses checks and replacement always revalidates', () => {
  const decision = evaluateVehicleAssignmentPermission(assignableInput({
    externalFleetOrganisation: true,
    externalFleetOrganisationActive: false
  }));
  assert.equal(decision.assignable, false);
  assert.ok(decision.blockers.includes('EXTERNAL_FLEET_ORGANISATION_NOT_ACTIVE'));
  assert.equal(decision.externalTenancyBypassAllowed, false);
  assert.equal(decision.replacementRequiresFreshValidation, true);
  assert.equal(GENERIC_FLEET_DISCOUNT_CLAIM_ALLOWED, false);
});

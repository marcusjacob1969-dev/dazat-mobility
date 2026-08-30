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
  BREAKDOWN_ALONE_PROVES_DRIVER_NEGLECT,
  DEFECT_REPORT_CREATES_DRIVER_FAULT_FINDING,
  PASSENGER_CONTINUITY_IS_REPLACEMENT_ASSIGNMENT,
  REPLACEMENT_WORKFLOW_MAY_PENALISE_DEFECT_REPORTING,
  UNVERIFIED_PERK_MAY_BE_MARKETED,
  VEHICLE_RELIABILITY_IS_DRIVER_COMPLIANCE,
  canTransitionVehicleDefect,
  evaluateMaintenanceOperatingGate,
  evaluatePreShiftCheck,
  repairMayBeAuthorised,
  returnToServiceMayBeApproved,
  verifiedPerkMayBePublished,
  wholeLifeCostEvidenceIsComplete
} = await import('../../packages/domain/src/maintenance-reliability.ts');

function passingItems(overrides = {}) {
  return {
    TYRES: 'PASS', LIGHTS: 'PASS', BRAKES: 'PASS', STEERING: 'PASS',
    MIRRORS: 'PASS', SEATBELTS: 'PASS', WARNING_INDICATORS: 'PASS',
    ACCESSIBILITY_EQUIPMENT: 'NOT_APPLICABLE', ...overrides
  };
}

test('pre-shift pass permits use without inventing a defect', () => {
  const result = evaluatePreShiftCheck({ items: passingItems(), uncertainConcernText: null });
  assert.equal(result.outcome, 'PASS');
  assert.equal(result.vehicleUsePermitted, true);
  assert.equal(result.createDefect, false);
});

test('core roadworthiness checks cannot be dismissed as not applicable', () => {
  assert.throws(() => evaluatePreShiftCheck({
    items: passingItems({ BRAKES: 'NOT_APPLICABLE' }), uncertainConcernText: null
  }), /Core roadworthiness items cannot be marked not applicable/);
});

test('Driver uncertainty is accepted without diagnosis and fails safe to review', () => {
  const result = evaluatePreShiftCheck({
    items: passingItems({ STEERING: 'NOT_SURE' }),
    uncertainConcernText: 'I do not know what it is, but something does not feel right.'
  });
  assert.equal(result.outcome, 'CONCERN_REPORTED');
  assert.equal(result.maintenanceUrgency, 'SAFETY_REVIEW');
  assert.equal(result.vehicleUsePermitted, false);
  assert.equal(result.driverDiagnosisRequired, false);
  assert.equal(result.createsDriverFaultFinding, false);
});

test('failed pre-shift item creates a DO_NOT_USE result', () => {
  const result = evaluatePreShiftCheck({ items: passingItems({ BRAKES: 'FAIL' }), uncertainConcernText: null });
  assert.equal(result.outcome, 'FAIL');
  assert.equal(result.maintenanceUrgency, 'DO_NOT_USE');
  assert.equal(result.vehicleUsePermitted, false);
});

test('maintenance gate fails closed for no plan, safety review and scoped service restriction', () => {
  const noPlan = evaluateMaintenanceOperatingGate({
    activePlanPresent: false, activeRequirementsPresent: false, highestUrgency: null, allServicesRestrictionActive: false,
    unresolvedSafetyCriticalRecall: false,
    restrictedServiceCodes: [], requestedServiceCodes: ['STANDARD']
  });
  assert.ok(noPlan.blockers.includes('ACTIVE_MAINTENANCE_PLAN_REQUIRED'));
  const restricted = evaluateMaintenanceOperatingGate({
    activePlanPresent: true, activeRequirementsPresent: true, highestUrgency: 'SAFETY_REVIEW', allServicesRestrictionActive: false,
    unresolvedSafetyCriticalRecall: false,
    restrictedServiceCodes: ['WAV'], requestedServiceCodes: ['WAV']
  });
  assert.ok(restricted.blockers.includes('VEHICLE_SAFETY_REVIEW_REQUIRED'));
  assert.ok(restricted.blockers.includes('VEHICLE_SERVICE_RESTRICTED'));
  const recalled = evaluateMaintenanceOperatingGate({
    activePlanPresent: true, activeRequirementsPresent: true, highestUrgency: 'ROUTINE', allServicesRestrictionActive: false,
    unresolvedSafetyCriticalRecall: true, restrictedServiceCodes: [], requestedServiceCodes: ['STANDARD']
  });
  assert.equal(recalled.operatingPermitted, false);
  assert.ok(recalled.blockers.includes('UNRESOLVED_SAFETY_CRITICAL_RECALL'));
});

test('overdue is explicit but does not invent neglect or a legal hard-stop without a restriction', () => {
  const result = evaluateMaintenanceOperatingGate({
    activePlanPresent: true, activeRequirementsPresent: true, highestUrgency: 'OVERDUE', allServicesRestrictionActive: false,
    unresolvedSafetyCriticalRecall: false,
    restrictedServiceCodes: [], requestedServiceCodes: ['STANDARD']
  });
  assert.equal(result.operatingPermitted, true);
  assert.equal(result.actionRequired, true);
  assert.equal(result.overdueAutomaticallyProvesNeglect, false);
});

test('defect lifecycle, warranty-first repair and reviewed return-to-service remain separate', () => {
  assert.equal(canTransitionVehicleDefect('OPEN', 'REPAIR_REQUIRED'), true);
  assert.equal(canTransitionVehicleDefect('CLOSED', 'OPEN'), false);
  assert.equal(repairMayBeAuthorised({ estimatePresent: true, warrantyEvaluatedFirst: false, authorisedDecision: true }), false);
  assert.equal(repairMayBeAuthorised({ estimatePresent: true, warrantyEvaluatedFirst: true, authorisedDecision: true }), true);
  assert.equal(returnToServiceMayBeApproved({
    completionRecordPresent: true,
    postRepairInspectionPassed: true,
    openSafetyCriticalDefect: false,
    activeVehicleRestriction: false,
    requiredMaintenanceOutstanding: false,
    independentReviewer: true,
    evidenceReferences: ['inspection-evidence']
  }), true);
  assert.equal(returnToServiceMayBeApproved({
    completionRecordPresent: true,
    postRepairInspectionPassed: true,
    openSafetyCriticalDefect: true,
    activeVehicleRestriction: false,
    requiredMaintenanceOutstanding: false,
    independentReviewer: true,
    evidenceReferences: ['inspection-evidence']
  }), false);
});

test('perks require verified real terms before marketing', () => {
  assert.equal(verifiedPerkMayBePublished({
    providerVerified: true,
    benefitTermsExplicit: true,
    eligibilityExplicit: true,
    redemptionRouteExplicit: true,
    evidenceReferences: ['signed-provider-schedule'],
    currentlyEffective: true
  }), true);
  assert.equal(verifiedPerkMayBePublished({
    providerVerified: false,
    benefitTermsExplicit: true,
    eligibilityExplicit: true,
    redemptionRouteExplicit: true,
    evidenceReferences: [],
    currentlyEffective: true
  }), false);
  assert.equal(UNVERIFIED_PERK_MAY_BE_MARKETED, false);
});

test('whole-life evidence requires every cost component and is not brochure price', () => {
  const componentsMinor = {
    ACQUISITION: 3000000, DEPRECIATION: 1200000, INSURANCE: 400000, SERVICE: 200000,
    REPAIR: 150000, TYRES: 80000, ENERGY: 500000, DOWNTIME: 250000, RESALE: 900000
  };
  assert.equal(wholeLifeCostEvidenceIsComplete({
    componentsMinor, evidenceReferences: ['fleet-cost-model-v1'], brochurePriceOnly: false
  }), true);
  assert.equal(wholeLifeCostEvidenceIsComplete({
    componentsMinor, evidenceReferences: ['brochure'], brochurePriceOnly: true
  }), false);
});

test('reliability, Driver compliance, replacement and passenger continuity never collapse', () => {
  assert.equal(BREAKDOWN_ALONE_PROVES_DRIVER_NEGLECT, false);
  assert.equal(VEHICLE_RELIABILITY_IS_DRIVER_COMPLIANCE, false);
  assert.equal(DEFECT_REPORT_CREATES_DRIVER_FAULT_FINDING, false);
  assert.equal(REPLACEMENT_WORKFLOW_MAY_PENALISE_DEFECT_REPORTING, false);
  assert.equal(PASSENGER_CONTINUITY_IS_REPLACEMENT_ASSIGNMENT, false);
});

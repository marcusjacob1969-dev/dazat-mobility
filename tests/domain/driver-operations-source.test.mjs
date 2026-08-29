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
  OCR_IS_AUTHORITATIVE_COMPLIANCE_VERIFICATION,
  canTransitionDriverApplication,
  documentSatisfiesCompliance,
  evaluateDriverOperatingEligibility,
  trainingGrantsCompetency
} = await import('../../packages/domain/src/driver-operations.ts');
const { canUseAccountCapability } = await import('../../packages/domain/src/identity.ts');
const { evaluateDriverDispatchEligibility } = await import('../../packages/domain/src/dispatch.ts');

const now = new Date('2026-08-29T12:00:00.000Z');
const future = new Date('2027-08-29T12:00:00.000Z');
const past = new Date('2025-08-29T12:00:00.000Z');

function eligibleInput(overrides = {}) {
  return {
    accountActive: true,
    driverApproved: true,
    complianceCurrent: true,
    selectedVehiclePresent: true,
    selectedVehicleAuthorised: true,
    selectedVehicleEligible: true,
    currentPermissionServiceCodes: ['STANDARD', 'SCHOOL', 'WAV'],
    activeRestrictionScopes: [],
    ...overrides
  };
}

test('DriverApplication cannot self-service shortcut to approval', () => {
  assert.equal(canTransitionDriverApplication('STARTED', 'CONTACT_VERIFIED'), true);
  assert.equal(canTransitionDriverApplication('CONTACT_VERIFIED', 'APPROVED'), false);
  assert.equal(canTransitionDriverApplication('DOCUMENTS_PENDING', 'APPROVED'), false);
  assert.equal(canTransitionDriverApplication('REVIEW_PENDING', 'APPROVED'), true);
  assert.equal(canTransitionDriverApplication('APPROVED', 'STARTED'), false);
});

test('OCR extraction is not authoritative compliance verification', () => {
  assert.equal(OCR_IS_AUTHORITATIVE_COMPLIANCE_VERIFICATION, false);
  assert.equal(documentSatisfiesCompliance({ status: 'EXTRACTED', authorisedReviewDecision: null, validUntil: future, now }), false);
  assert.equal(documentSatisfiesCompliance({ status: 'VERIFIED', authorisedReviewDecision: null, validUntil: future, now }), false);
  assert.equal(documentSatisfiesCompliance({ status: 'VERIFIED', authorisedReviewDecision: 'VERIFIED', validUntil: future, now }), true);
  assert.equal(documentSatisfiesCompliance({ status: 'VERIFIED', authorisedReviewDecision: 'VERIFIED', validUntil: past, now }), false);
});

test('attendance alone never grants competency', () => {
  assert.equal(trainingGrantsCompetency({ status: 'ATTENDED', assessmentRequired: false, assessmentPassed: false, competencyConfirmed: false, validUntil: future, now }), false);
  assert.equal(trainingGrantsCompetency({ status: 'PASSED', assessmentRequired: true, assessmentPassed: false, competencyConfirmed: true, validUntil: future, now }), false);
  assert.equal(trainingGrantsCompetency({ status: 'PASSED', assessmentRequired: true, assessmentPassed: true, competencyConfirmed: true, validUntil: future, now }), true);
  assert.equal(trainingGrantsCompetency({ status: 'PASSED', assessmentRequired: true, assessmentPassed: true, competencyConfirmed: true, validUntil: past, now }), false);
});

test('all independent operating truths must pass', () => {
  assert.equal(evaluateDriverOperatingEligibility(eligibleInput()).status, 'ELIGIBLE');
  for (const [override, blocker] of [
    [{ accountActive: false }, 'ACCOUNT_NOT_ACTIVE'],
    [{ driverApproved: false }, 'DRIVER_APPLICATION_NOT_APPROVED'],
    [{ complianceCurrent: false }, 'DRIVER_COMPLIANCE_NOT_CURRENT'],
    [{ selectedVehiclePresent: false }, 'SELECTED_VEHICLE_REQUIRED'],
    [{ selectedVehicleAuthorised: false }, 'DRIVER_VEHICLE_PAIR_NOT_AUTHORISED'],
    [{ selectedVehicleEligible: false }, 'VEHICLE_NOT_ELIGIBLE'],
    [{ currentPermissionServiceCodes: [] }, 'NO_CURRENT_SERVICE_PERMISSION'],
    [{ activeRestrictionScopes: ['NEW_JOURNEYS'] }, 'OPERATING_RESTRICTION_ACTIVE']
  ]) {
    const decision = evaluateDriverOperatingEligibility(eligibleInput(override));
    assert.equal(decision.status, 'NOT_ELIGIBLE');
    assert.ok(decision.blockers.includes(blocker));
    assert.deepEqual(decision.eligibleServiceCodes, []);
    assert.equal(decision.availabilityEvaluatedSeparately, true);
  }
});

test('School and WAV restrictions narrow service permission without inventing a broad ban', () => {
  const school = evaluateDriverOperatingEligibility(eligibleInput({ activeRestrictionScopes: ['SCHOOL_ONLY'] }));
  assert.equal(school.status, 'PARTIALLY_ELIGIBLE');
  assert.deepEqual(school.eligibleServiceCodes, ['STANDARD', 'WAV']);
  assert.deepEqual(school.blockers, []);

  const allScoped = evaluateDriverOperatingEligibility(eligibleInput({
    currentPermissionServiceCodes: ['SCHOOL', 'WAV'], activeRestrictionScopes: ['SCHOOL_ONLY', 'WAV_ONLY']
  }));
  assert.equal(allScoped.status, 'NOT_ELIGIBLE');
  assert.deepEqual(allScoped.blockers, ['ALL_CURRENT_SERVICE_PERMISSIONS_RESTRICTED']);
});

test('a matching specific-vehicle restriction blocks that selected vehicle', () => {
  const decision = evaluateDriverOperatingEligibility(eligibleInput({ activeRestrictionScopes: ['SPECIFIC_VEHICLE'] }));
  assert.equal(decision.status, 'NOT_ELIGIBLE');
  assert.ok(decision.blockers.includes('SELECTED_VEHICLE_RESTRICTION_ACTIVE'));
});

test('payout-only restriction does not silently become an operating ban', () => {
  const decision = evaluateDriverOperatingEligibility(eligibleInput({ activeRestrictionScopes: ['PAYOUT_ONLY'] }));
  assert.equal(decision.status, 'ELIGIBLE');
  assert.deepEqual(decision.blockers, []);
});

test('availability remains distinct and limited accounts cannot mutate applications', () => {
  assert.equal(evaluateDriverOperatingEligibility(eligibleInput()).availabilityEvaluatedSeparately, true);
  assert.equal(canUseAccountCapability('LIMITED', 'VIEW_PROFILE'), true);
  assert.equal(canUseAccountCapability('LIMITED', 'MANAGE_DRIVER_APPLICATION'), false);
  assert.equal(canUseAccountCapability('ACTIVE', 'MANAGE_DRIVER_APPLICATION'), true);
});

test('Dispatch hard filters scoped permission and active operating restriction', () => {
  const base = {
    accountActive: true,
    driverProfileApproved: true,
    complianceStatus: 'ELIGIBLE',
    complianceValidUntil: future,
    vehicleAuthorised: true,
    vehicleStatus: 'ELIGIBLE',
    vehicleValidUntil: future,
    servicePermissionMatch: true,
    operatingRestrictionActive: false,
    availabilityStatus: 'AVAILABLE',
    locationObservedAt: now,
    locationConfidence: 0.95,
    minimumLocationConfidence: 0.5,
    maxLocationAgeSeconds: 90,
    hasActiveAssignment: false,
    hasScheduleConflict: false,
    hardRequirementsMatch: true
  };
  assert.equal(evaluateDriverDispatchEligibility(base, now).eligible, true);
  assert.ok(evaluateDriverDispatchEligibility({ ...base, servicePermissionMatch: false }, now).blockers.includes('SERVICE_PERMISSION_MISMATCH'));
  assert.ok(evaluateDriverDispatchEligibility({ ...base, operatingRestrictionActive: true }, now).blockers.includes('OPERATING_RESTRICTION_ACTIVE'));
});

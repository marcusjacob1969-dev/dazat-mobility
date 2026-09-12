import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const demo = readFileSync(join(root, 'scripts/demo-core-journey.mjs'), 'utf8');
const currentVerifier = readFileSync(join(root, 'scripts/verify-current.mjs'), 'utf8');
const requiredScenarios = ['happy-path', 'ineligible-driver', 'fatigue-blocked', 'stale-pickup-evidence', 'ridecheck-blocked', 'completion-hold', 'destination-evidence-rejected'];
const requiredBlockers = ['COMPLIANCE_NOT_ELIGIBLE', 'FATIGUE_SAFETY_BLOCKED', 'LOCATION_STALE', 'RIDECHECK_MISMATCH', 'ACTIVE_COMPLETION_HOLD', 'DESTINATION_EVIDENCE_REJECTED'];
const errors = [];
for (const scenario of requiredScenarios) if (!demo.includes(`'${scenario}'`)) errors.push(`Core-journey demo must include ${scenario}`);
for (const blocker of requiredBlockers) if (!demo.includes(`'${blocker}'`)) errors.push(`Core-journey demo must prove blocker ${blocker}`);
if (!demo.includes('!result.realPaymentAttempted && !result.externalProviderContacted')) errors.push('Failure proofs must preserve provider-disabled and no-real-payment invariants');
if (!demo.includes("checkpoint: 'engineering-phase-0.98'")) errors.push('Core-journey demo must report the Phase 0.98 checkpoint');
const currentRange = currentVerifier.match(/for \(let phase = (\d+); phase <= (\d+); phase \+= 1\)/);
if (!currentRange || Number(currentRange[2]) < 98) errors.push('Current-checkpoint verifier must cover through at least Phase 0.98');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.98 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.98 verification PASSED');

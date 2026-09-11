import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runtimeContract = readFileSync(join(root, 'tests/api/runtime-contract.test.mjs'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];

const expectedCheckpoint = "checkpoint, 'engineering-phase-0.95'";
if (!runtimeContract.includes(expectedCheckpoint)) {
  errors.push('Runtime build-info contract must assert the current Phase 0.95 checkpoint');
}
if (runtimeContract.includes("engineering-phase-0.91")) {
  errors.push('Runtime build-info contract still asserts stale Phase 0.91 metadata');
}
if (!runtimeContract.includes("build.json().product, 'DAZAT Mobility'")) {
  errors.push('Runtime build-info contract must assert the product identity');
}
if (!runtimeContract.includes("build.json().implementationStatus, 'CURRENT_CHECKPOINT_VERIFIED_PROVIDER_AND_OPERATIONAL_MUTATIONS_DISABLED'")) {
  errors.push('Runtime build-info contract must assert provider and operational mutations remain disabled');
}
if (!app.includes("checkpoint: 'engineering-phase-0.95'")) {
  errors.push('API source must expose the Phase 0.95 checkpoint');
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.96 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.96 verification PASSED');

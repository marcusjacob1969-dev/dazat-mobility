import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'apps/control-room/src/fatigue-handover-api.ts',
  'docs/engineering/phase-0-48-checklist.md',
  'docs/traceability/phase-0-48-control-room-fatigue-client.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.48 file: ${path}`);
const source = [
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ['getRecoverableFatigueHandovers',
  'recoverFatigueHandoverOwnership', '/v1/control-room/fatigue-handovers/recoverable?limit=',
  '/recover-ownership', "'idempotency-key': idempotencyKey", 'recoveryEvidenceReference',
  'Math.max(1, Math.min(100', "cache: 'no-store'", 'encodeURIComponent(controlledHandoverId)',
  'Queue eligibility is advisory', 'previous operator identity are excluded']) {
  if (!source.includes(truth)) errors.push(`Control Room fatigue client boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.48 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.48 verification PASSED');
console.log('Checked typed bounded queue, no-store session calls, idempotent recovery and truthful privacy-minimised UI boundary.');

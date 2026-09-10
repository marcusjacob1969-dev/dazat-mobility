import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const validator = readFileSync(join(root, 'scripts/validate-api-audit.mjs'), 'utf8');
const errors = [];
for (const truth of ['npm audit --workspace @dazat/api --omit=dev --audit-level=high --json', 'validate-api-audit.mjs', 'dazat-api-vulnerability-audit-${{ github.sha }}', 'dazat-api-audit.json', 'if-no-files-found: error', 'retention-days: 14']) {
  if (!workflow.includes(truth)) errors.push(`Hosted vulnerability evidence missing: ${truth}`);
}
for (const truth of ['auditReportVersion !== 2', "['high', 'critical']", 'vulnerabilities[severity] !== 0', 'metadata.dependencies.total']) {
  if (!validator.includes(truth)) errors.push(`Vulnerability evidence validation missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.87 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.87 verification PASSED');

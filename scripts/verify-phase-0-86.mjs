import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const validator = readFileSync(join(root, 'scripts/validate-api-sbom.mjs'), 'utf8');
const errors = [];
for (const truth of ['npm sbom --workspace @dazat/api --omit=dev --sbom-format cyclonedx', 'validate-api-sbom.mjs', 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', 'dazat-api-sbom-${{ github.sha }}', 'if-no-files-found: error', 'retention-days: 14']) {
  if (!workflow.includes(truth)) errors.push(`Hosted SBOM evidence missing: ${truth}`);
}
for (const truth of ["sbom.bomFormat !== 'CycloneDX'", "sbom.specVersion !== '1.5'", 'urn:uuid:', "'fastify', 'pg', 'zod'", "component.name === 'typescript'", 'sbom.dependencies']) {
  if (!validator.includes(truth)) errors.push(`SBOM validation missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.86 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.86 verification PASSED');

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];

const workflowPath = join(root, '.github/workflows/postgres-migration-verification.yml');
const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';

for (const truth of [
  'docker run --detach --name dazat-api-smoke',
  '--read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m',
  '--cap-drop ALL',
  '--security-opt no-new-privileges:true',
  "'{{.Config.User}}' dazat-api:${{ github.sha }}",
  'test "$(docker inspect --format \'{{.State.ExitCode}}\' dazat-api-smoke)" = "0"'
]) {
  if (!workflow.includes(truth)) errors.push(`Restricted container gate missing: ${truth}`);
}

if (workflow.includes('--privileged')) errors.push('Restricted container gate must not enable privileged mode');
if (workflow.includes('--cap-add')) errors.push('Restricted container gate must not add Linux capabilities');
if (workflow.includes('--security-opt seccomp=unconfined')) errors.push('Restricted container gate must not disable seccomp confinement');
if (workflow.includes('--security-opt apparmor=unconfined')) errors.push('Restricted container gate must not disable AppArmor confinement');

const buildInfoPath = join(root, 'services/api/src/app.ts');
const buildInfo = existsSync(buildInfoPath) ? readFileSync(buildInfoPath, 'utf8') : '';
if (!/checkpoint:\s*'engineering-phase-0\.(9[1-9]|[1-9][0-9])'/.test(buildInfo)) {
  errors.push('API build checkpoint is not a post-0.90 engineering checkpoint');
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.91 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.91 verification PASSED');

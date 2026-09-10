import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const lifecycle = readFileSync(join(root, 'services/api/src/runtime-lifecycle.ts'), 'utf8');
const main = readFileSync(join(root, 'services/api/src/main.ts'), 'utf8');
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const testSource = readFileSync(join(root, 'tests/api/runtime-lifecycle.test.mjs'), 'utf8');
const errors = [];
for (const truth of ["runtime.once('SIGTERM'", "runtime.once('SIGINT'", 'if (shutdownPromise) return shutdownPromise', 'app.close()', 'runtime.exitCode = 1']) if (!lifecycle.includes(truth)) errors.push(`Lifecycle guard missing: ${truth}`);
if (!main.includes('installGracefulShutdown(app)')) errors.push('API startup does not install graceful shutdown');
for (const truth of ['docker stop --time 10 dazat-api-smoke', '.State.ExitCode', '"0"']) if (!workflow.includes(truth)) errors.push(`Hosted shutdown proof missing: ${truth}`);
for (const truth of ['closes, 1', 'exitCode, 1']) if (!testSource.includes(truth)) errors.push(`Lifecycle runtime test missing: ${truth}`);
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.84 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.84 verification PASSED');

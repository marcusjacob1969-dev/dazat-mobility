import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, npm_config_offline: 'true' }, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const checkpointPhases = readdirSync(join(root, 'scripts'))
  .map((name) => name.match(/^verify-phase-0-(\\d+)\\.mjs$/))
  .filter(Boolean)
  .map((match) => Number(match[1]))
  .filter((phase) => phase >= 25)
  .sort((a, b) => a - b);
if (checkpointPhases[0] !== 25) throw new Error('Current checkpoint verifier set must begin at Phase 0.25');
for (let index = 0; index < checkpointPhases.length; index += 1) {
  const expected = 25 + index;
  if (checkpointPhases[index] !== expected) {
    throw new Error(`Missing current checkpoint verifier: scripts/verify-phase-0-${expected}.mjs`);
  }
  run(process.execPath, [join(root, 'scripts', `verify-phase-0-${checkpointPhases[index]}.mjs`)]);
}
for (const project of ['services/api/tsconfig.json', 'apps/rider/tsconfig.json', 'apps/driver/tsconfig.json', 'apps/control-room/tsconfig.json']) {
  run(join(root, 'node_modules/.bin/tsc'), ['-p', project]);
}
run('npm', ['run', 'test:api-runtime']);
run('npm', ['run', 'demo:core-journey']);
console.log('DAZAT current checkpoint verification PASSED');
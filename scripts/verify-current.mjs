import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, npm_config_offline: 'true' }, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (let phase = 25; phase <= 67; phase += 1) {
  const verifier = join(root, `scripts/verify-phase-0-${phase}.mjs`);
  if (!existsSync(verifier)) throw new Error(`Missing current checkpoint verifier: ${verifier}`);
  run(process.execPath, [verifier]);
}
for (const project of ['services/api/tsconfig.json', 'apps/rider/tsconfig.json', 'apps/driver/tsconfig.json', 'apps/control-room/tsconfig.json']) {
  run(join(root, 'node_modules/.bin/tsc'), ['-p', project]);
}
run('npm', ['run', 'test:api-runtime']);
run('npm', ['run', 'demo:core-journey']);
console.log('DAZAT current checkpoint verification PASSED');

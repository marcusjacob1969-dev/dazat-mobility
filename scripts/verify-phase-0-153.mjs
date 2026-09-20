import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(root.scripts['dev:rider'], 'npm run dev --workspace @dazat/rider');
assert.equal(root.scripts['dev:driver'], 'npm run dev --workspace @dazat/driver');
assert.equal(root.scripts['dev:control-room'], 'npm run dev --workspace @dazat/control-room');
assert.equal(root.scripts['build:apps'], 'npm run build:core && npm run build --workspace @dazat/api && npm run build --workspace @dazat/control-room && npm run typecheck --workspace @dazat/rider && npm run typecheck --workspace @dazat/driver');

for (const app of ['rider', 'driver']) {
  const pkg = JSON.parse(readFileSync(new URL(`../apps/${app}/package.json`, import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.dev, 'expo start');
  assert.equal(pkg.scripts.typecheck, 'tsc -p tsconfig.json --noEmit');
  const appJson = JSON.parse(readFileSync(new URL(`../apps/${app}/app.json`, import.meta.url), 'utf8'));
  assert.ok(appJson.expo?.name);
  assert.ok(appJson.expo?.slug);
}

const controlRoom = JSON.parse(readFileSync(new URL('../apps/control-room/package.json', import.meta.url), 'utf8'));
assert.equal(controlRoom.scripts.dev, 'vite');
assert.equal(controlRoom.scripts.build, 'tsc -b && vite build');

console.log('Phase 0.153 working-app launch surface verification PASSED');

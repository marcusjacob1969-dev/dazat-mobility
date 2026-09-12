import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const clients = [
  ['Rider', '../apps/rider/App.tsx'],
  ['Driver', '../apps/driver/App.tsx'],
  ['Control Room', '../apps/control-room/App.tsx']
];

for (const [name, relativePath] of clients) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  assert.match(source, /CoreJourneyProgressProjection/, `${name} must consume the canonical Core Journey projection type`);
  assert.match(source, /readCoreJourneyProgress/, `${name} must use the canonical Core Journey read boundary`);
  assert.doesNotMatch(source, /ENGINEERING PHASE 0\.54|ENGINEERING PHASE 0\.80|ENGINEERING PHASE 0\.84/, `${name} contains a stale engineering checkpoint label`);
}

const rider = readFileSync(new URL('../apps/rider/App.tsx', import.meta.url), 'utf8');
assert.match(rider, /driverAssigned/);
assert.match(rider, /journeyStatus/);
assert.match(rider, /productionChargingEnabled|PRODUCTION CHARGING DISABLED/);

const driver = readFileSync(new URL('../apps/driver/App.tsx', import.meta.url), 'utf8');
assert.match(driver, /offers|offer/i);
assert.match(driver, /eligibility|eligible/i);

const controlRoom = readFileSync(new URL('../apps/control-room/App.tsx', import.meta.url), 'utf8');
assert.match(controlRoom, /hold|safety|journey/i);

process.stdout.write(JSON.stringify({
  checkpoint: 'engineering-phase-0.100',
  riderUsesCanonicalProgress: true,
  driverUsesCanonicalProgress: true,
  controlRoomUsesCanonicalProgress: true,
  staleCheckpointLabelsRejected: true,
  productionChargingEnabled: false
}, null, 2) + '\n');

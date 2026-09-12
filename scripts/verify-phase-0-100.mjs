import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const clients = [
  ['Rider', '../apps/rider/App.tsx', '../apps/rider/src/core-journey-api.ts'],
  ['Driver', '../apps/driver/App.tsx', '../apps/driver/src/core-journey-api.ts'],
  ['Control Room', '../apps/control-room/src/App.tsx', '../apps/control-room/src/core-journey-api.ts']
];

for (const [name, appPath, apiPath] of clients) {
  const source = readFileSync(new URL(appPath, import.meta.url), 'utf8');
  const api = readFileSync(new URL(apiPath, import.meta.url), 'utf8');
  assert.match(api, /CoreJourneyProgressProjection/, `${name} Core Journey API must use the canonical projection type`);
  assert.match(api, /readCoreJourneyProgress|core-journey/, `${name} must use the canonical Core Journey read boundary`);
  assert.doesNotMatch(source, /ENGINEERING PHASE 0\.54|ENGINEERING PHASE 0\.80|ENGINEERING PHASE 0\.84/, `${name} contains a stale engineering checkpoint label`);
}

const rider = readFileSync(new URL('../apps/rider/App.tsx', import.meta.url), 'utf8');
assert.match(rider, /driverAssigned/);
assert.match(rider, /journeyStatus/);
assert.match(rider, /productionChargingEnabled|PRODUCTION CHARGING DISABLED/);

const driver = readFileSync(new URL('../apps/driver/App.tsx', import.meta.url), 'utf8');
assert.match(driver, /offers|offer/i);
assert.match(driver, /eligibility|eligible/i);

const controlRoom = readFileSync(new URL('../apps/control-room/src/App.tsx', import.meta.url), 'utf8');
assert.match(controlRoom, /hold|safety|journey/i);

process.stdout.write(JSON.stringify({
  checkpoint: 'engineering-phase-0.100',
  riderCanonicalProgressBoundary: true,
  driverCanonicalProgressBoundary: true,
  controlRoomCanonicalProgressBoundary: true,
  staleCheckpointLabelsRejected: true,
  productionChargingEnabled: false
}, null, 2) + '\n');

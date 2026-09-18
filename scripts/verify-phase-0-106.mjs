import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = {
  rider: join(root, 'apps/rider/App.tsx'),
  driver: join(root, 'apps/driver/App.tsx'),
  controlRoom: join(root, 'apps/control-room/src/App.tsx'),
  projection: join(root, 'packages/contracts/src/core-journey-progress.ts')
};
for (const [name, path] of Object.entries(files)) if (!existsSync(path)) throw new Error(`Missing Phase 0.106 ${name}: ${path}`);
const source = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, readFileSync(path, 'utf8')]));

for (const [name, app] of Object.entries({ rider: source.rider, driver: source.driver, controlRoom: source.controlRoom })) {
  if (!app.includes('journeyProgress.milestones.map') && !app.includes('journeyProgress?.milestones.map') && !app.includes('coreJourneyProgress.milestones.map')) throw new Error(`${name} must render canonical Journey milestones`);
  if (!app.includes('Canonical Journey milestones')) throw new Error(`${name} milestone accessibility boundary is missing`);
  if (!app.includes("milestone.name.replaceAll('_', ' ')")) throw new Error(`${name} must display canonical milestone names`);
  if (!app.includes('milestone.status')) throw new Error(`${name} must display canonical milestone status`);
  if (app.includes('setJourneyMilestones') || app.includes('useState<') && app.includes('milestone')) throw new Error(`${name} must not create UI-local milestone authority`);
}
if (!source.projection.includes('CoreJourneyProgressProjection')) throw new Error('Canonical Core Journey projection type is missing');
if (!source.projection.includes('milestones: CoreJourneyMilestone[]')) throw new Error('Canonical milestone collection is missing');
console.log('DAZAT Phase 0.106 canonical milestone timeline verification PASSED');

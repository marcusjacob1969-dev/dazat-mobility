import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const workflow = readFileSync(new URL('.github/workflows/postgres-migration-verification.yml', root), 'utf8');

const pinnedPostgis = 'postgis/postgis:16-3.4@sha256:44126d872ac91993766c341e369c539e8196614321765d36a6f1bab0419a5fa5';
if (!workflow.includes(`docker pull ${pinnedPostgis}`)) {
  throw new Error('API container verification must explicitly pull the pinned PostGIS image before runtime use');
}
if (!workflow.includes('for attempt in $(seq 1 5); do docker pull')) {
  throw new Error('API container verification must retry the pinned PostGIS pull to tolerate transient registry resets');
}
if (!workflow.includes('test "$attempt" -lt 5')) {
  throw new Error('PostGIS pull retry loop must have a bounded five-attempt limit');
}
if (!workflow.includes(pinnedPostgis)) {
  throw new Error('PostGIS image must remain immutable and digest-pinned');
}

console.log('Phase 0.93 container pull resilience verification PASSED');

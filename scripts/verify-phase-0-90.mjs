import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const path = join(root, '.github/dependabot.yml');
const errors = [];
if (!existsSync(path)) errors.push('Dependabot configuration is missing');
const config = existsSync(path) ? readFileSync(path, 'utf8') : '';
for (const truth of [
  'version: 2',
  'package-ecosystem: npm',
  'package-ecosystem: docker',
  'directory: /services/api',
  'package-ecosystem: docker-compose',
  'package-ecosystem: github-actions',
  'interval: weekly',
  'open-pull-requests-limit:'
]) if (!config.includes(truth)) errors.push(`Dependency monitoring missing: ${truth}`);
if ((config.match(/package-ecosystem:/g) ?? []).length !== 4) errors.push('Expected exactly four governed dependency ecosystems');
if (config.includes('target-branch:') || config.includes('insecure-external-code-execution: allow')) errors.push('Dependency monitoring weakens the default protected update path');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.90 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.90 verification PASSED');

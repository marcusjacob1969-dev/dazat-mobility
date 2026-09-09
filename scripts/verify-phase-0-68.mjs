import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const entries = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const expected = [...new Set(entries)].sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
const errors = [];
if (entries.join('\n') !== expected.join('\n')) errors.push('SOURCE_MANIFEST.txt is not unique and bytewise sorted');
if (!entries.includes('./scripts/verify-current.mjs')) errors.push('Current verification aggregate is absent from the manifest');
if (errors.length) { console.error('DAZAT Engineering Phase 0.68 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.68 verification PASSED');

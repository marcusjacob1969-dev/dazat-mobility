import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8'
})
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((path) => `./${path}`)
  .sort();

writeFileSync(join(root, 'SOURCE_MANIFEST.txt'), `${paths.join('\n')}\n`, 'utf8');
console.log(`SOURCE_MANIFEST.txt synchronised from ${paths.length} repository source paths.`);

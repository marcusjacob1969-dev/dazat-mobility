import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const errors = [];
const checkout = 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262';
const setupNode = 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020';
const upload = 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02';
if (workflow.split(checkout).length - 1 !== 3) errors.push('Every checkout action must use the verified commit');
if (workflow.split(setupNode).length - 1 !== 2) errors.push('Every setup-node action must use the verified commit');
if (workflow.split(upload).length - 1 !== 2) errors.push('Every artifact upload action must use the verified commit');
if (/uses:\s+actions\/(?:checkout|setup-node|upload-artifact)@v\d+/m.test(workflow)) errors.push('Mutable first-party action tag remains');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.88 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.88 verification PASSED');

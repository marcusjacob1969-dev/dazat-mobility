import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) throw new Error('CycloneDX SBOM path is required');
const sbom = JSON.parse(readFileSync(path, 'utf8'));
const errors = [];
if (sbom.bomFormat !== 'CycloneDX') errors.push('bomFormat must be CycloneDX');
if (sbom.specVersion !== '1.5') errors.push('CycloneDX specVersion must be 1.5');
if (!String(sbom.serialNumber ?? '').startsWith('urn:uuid:')) errors.push('SBOM serialNumber must be a UUID URN');
if (!sbom.metadata?.timestamp) errors.push('SBOM generation timestamp is required');
if (sbom.metadata?.component?.purl !== 'pkg:npm/dazat-mobility@0.0.21') errors.push('Root package identity is missing');
const components = Array.isArray(sbom.components) ? sbom.components : [];
for (const required of ['fastify', 'pg', 'zod']) {
  if (!components.some((component) => component.name === required && component.version && component.purl?.startsWith(`pkg:npm/${required}@`))) {
    errors.push(`Production dependency is missing from SBOM: ${required}`);
  }
}
if (components.some((component) => component.name === 'typescript' || component.name === 'tsx')) errors.push('Development-only compiler dependency leaked into production SBOM');
if (!Array.isArray(sbom.dependencies) || sbom.dependencies.length === 0) errors.push('SBOM dependency graph is missing');
if (errors.length) {
  console.error('DAZAT API SBOM validation FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`DAZAT API SBOM validation PASSED (${components.length} production components)`);

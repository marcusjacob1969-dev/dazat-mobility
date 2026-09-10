import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) throw new Error('npm audit JSON path is required');
const report = JSON.parse(readFileSync(path, 'utf8'));
const vulnerabilities = report.metadata?.vulnerabilities;
const errors = [];
if (report.auditReportVersion !== 2) errors.push('npm audit report version must be 2');
if (!vulnerabilities || !Number.isInteger(vulnerabilities.total)) errors.push('Vulnerability summary is missing');
for (const severity of ['high', 'critical']) {
  if (!Number.isInteger(vulnerabilities?.[severity])) errors.push(`${severity} vulnerability count is missing`);
  else if (vulnerabilities[severity] !== 0) errors.push(`${severity} vulnerability count must be zero`);
}
if (!report.metadata?.dependencies || !Number.isInteger(report.metadata.dependencies.total)) errors.push('Audited dependency count is missing');
if (errors.length) {
  console.error('DAZAT production API vulnerability evidence FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`DAZAT production API vulnerability evidence PASSED (${report.metadata.dependencies.total} dependencies, zero high/critical findings)`);

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0007_payment_finance_ledger_truth_foundation.sql',
  'packages/domain/src/finance.ts',
  'packages/contracts/src/finance.ts',
  'services/api/src/modules/finance/finance-service.ts',
  'services/api/src/modules/finance/routes.ts',
  'apps/rider/src/finance-api.ts',
  'apps/driver/src/finance-api.ts',
  'docs/architecture/ADR-0007-provider-neutral-finance-ledger-truth.md',
  'docs/engineering/phase-0-7-checklist.md',
  'docs/traceability/phase-0-7-requirements.md',
  'tests/domain/finance-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.7 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const additionsPath = join(root, 'SOURCE_MANIFEST_ADDITIONS.txt');
const additions = existsSync(additionsPath)
  ? readFileSync(additionsPath, 'utf8').trim().split('\n').filter(Boolean)
  : [];
const declared = [...manifest, ...additions].filter(Boolean).sort();
const duplicates = declared.filter((path, index) => index > 0 && path === declared[index - 1]);
if (duplicates.length) errors.push(`SOURCE_MANIFEST_ADDITIONS.txt contains duplicate source paths: ${duplicates.join(', ')}`);
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
const declaredSet = new Set(declared);
const trackedSet = new Set(tracked);
const missingFromManifest = tracked.filter((path) => !declaredSet.has(path));
const staleManifestEntries = declared.filter((path) => !trackedSet.has(path));
if (missingFromManifest.length || staleManifestEntries.length) {
  errors.push(`SOURCE_MANIFEST.txt plus SOURCE_MANIFEST_ADDITIONS.txt does not exactly match the source tree; missing entries: ${missingFromManifest.join(', ') || 'none'}; stale entries: ${staleManifestEntries.join(', ') || 'none'}`);
}

const sql = existsSync(join(root, required[0])) ? readFileSync(join(root, required[0]), 'utf8') : '';
for (const object of [
  'finance.payment_intent', 'finance.payment', 'finance.provider_event_inbox', 'finance.reconciliation_case',
  'finance.financial_account', 'finance.ledger_transaction', 'finance.ledger_entry', 'finance.refund',
  'finance.driver_earning', 'finance.payout_destination_change_request', 'finance.payout',
  'finance.command_deduplication', 'finance.outbox_message', 'finance.payment_status_projection'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.7 persistence object: ${object}`);
for (const guarantee of [
  "status = 'STATUS_UNKNOWN' AND NEW.reconciliation_required <> true",
  "charging_eligibility text NOT NULL DEFAULT 'NOT_ELIGIBLE'",
  'A posted ledger transaction must balance debits and credits', 'A reversal must exactly invert the original ledger entries',
  'Posted ledger transactions are immutable; use a reversal transaction',
  'Ledger entries are immutable; use a reversal transaction',
  'step_up_required boolean NOT NULL DEFAULT true CHECK (step_up_required = true)',
  'Raw PAN, CVV/CVC, PIN and track data are prohibited',
  'finance_one_active_payment_intent_per_booking'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.7 SQL guarantee: ${guarantee}`);

const domain = readFileSync(join(root, 'packages/domain/src/finance.ts'), 'utf8');
for (const guard of [
  'canTransitionPaymentStatus', 'paymentProviderTimeoutDecision', 'blindRetryAllowed: false',
  'evaluateBalancedLedger', 'reverseLedgerEntries', 'assertNoRawPaymentSecrets'
]) if (!domain.includes(guard)) errors.push(`Missing Finance domain guard: ${guard}`);

const service = readFileSync(join(root, 'services/api/src/modules/finance/finance-service.ts'), 'utf8');
for (const guard of [
  "row.booking_status !== 'COMPLETED'", "role = 'PAYER'", 'providerActionAttempted: false',
  'productionChargingEnabled: false', "nextAction: 'PROVIDER_CONFIGURATION_REQUIRED'",
  "charging_eligibility !== 'NOT_ELIGIBLE'",
  'blindRetryAllowed: false', 'No captured Payment exists', 'riderFareUsedAsDriverEarning: false'
]) if (!service.includes(guard)) errors.push(`Missing transactional Finance guard: ${guard}`);
if (/fetch\(|axios|stripe|adyen|braintree|checkout\.com|provider\.capture/i.test(service)) {
  errors.push('Provider-disabled Finance service contains a provider/network charging dependency');
}
if (/INSERT INTO finance\.(payment|ledger_transaction|ledger_entry|driver_earning|payout)\b/i.test(service)) {
  errors.push('Provider-disabled Rider intent path can create Payment, ledger, DriverEarning or Payout truth');
}

const routes = readFileSync(join(root, 'services/api/src/modules/finance/routes.ts'), 'utf8');
for (const path of ['/payment-intents', '/payments/:paymentId/status', '/receipts/:bookingId', '/driver/earnings']) {
  if (!routes.includes(path)) errors.push(`Finance API route missing: ${path}`);
}
if (/refund|payout-destination|webhook/i.test(routes)) errors.push('Unauthorised Phase 0.7 refund, payout-destination or webhook mutation route exposed');

const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
for (const guard of ["paymentProviderMode: 'disabled'", "PAYMENT_PROVIDER_MODE must remain disabled"]) {
  if (!config.includes(guard)) errors.push(`Payment provider fail-closed config missing: ${guard}`);
}
if (!routes.includes("'PREPARE_PAYMENT'")) errors.push('PaymentIntent mutation lacks its dedicated account capability');

const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
for (const truth of ['charging disabled', 'Completion itself did not initiate payment', 'NO CHARGE ATTEMPTED']) {
  if (!rider.includes(truth)) errors.push(`Rider Finance truth label missing: ${truth}`);
}
const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
for (const truth of ['no earning is inferred from the Rider fare', 'not itself an earning or payout']) {
  if (!driver.includes(truth)) errors.push(`Driver Finance truth label missing: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of ['STATUS_UNKNOWN', 'cannot blindly retry', 'cannot directly edit a balance', 'payout destination changes remain a separate high-risk workflow']) {
  if (!controlRoom.includes(truth)) errors.push(`Control Room Finance boundary missing: ${truth}`);
}

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/payment-intents:', '/payments/{paymentId}/status:', '/receipts/{bookingId}:', '/driver/earnings:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.7 path missing: ${path}`);
}
for (const statement of ['Charging is disabled', 'STATUS_UNKNOWN includes reconciliation guidance', 'Rider fare is never projected as a Driver earning']) {
  if (!api.includes(statement)) errors.push(`OpenAPI Finance truth statement missing: ${statement}`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.7 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.7 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus provider-disablement, money, ledger, reconciliation and projection boundaries.`);
console.log(`Source manifest baseline plus ${additions.length} explicit additions exactly matches the source tree.`);

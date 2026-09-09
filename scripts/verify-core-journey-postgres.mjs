import pg from 'pg';
import {
  CoreJourneyNotFoundError,
  getControlRoomCoreJourneyProgress,
  getCoreJourneyProgress,
  getDriverCoreJourneyProgress
} from '../services/api/dist/modules/core-journey/core-journey-service.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.DAZAT_MIGRATION_VALIDATION_TARGET !== 'ephemeral') {
  throw new Error('Core-journey PostgreSQL verification requires the explicitly ephemeral migration target');
}

const pool = new pg.Pool({ connectionString, max: 1 });
const actor = {
  accountId: '00000000-0000-4000-8000-000000000001',
  personId: '00000000-0000-4000-8000-000000000002',
  accountStatus: 'ACTIVE',
  sessionId: '00000000-0000-4000-8000-000000000003',
  authStrength: 'VERIFIED_CONTACT',
  expiresAt: new Date(Date.now() + 60_000),
  riderProfileId: '00000000-0000-4000-8000-000000000004',
  driverProfileId: '00000000-0000-4000-8000-000000000005'
};
const bookingId = '00000000-0000-4000-8000-000000000006';
const handoverId = '00000000-0000-4000-8000-000000000007';

async function expectEmptyButValid(label, operation) {
  try { await operation(); }
  catch (error) {
    if (error instanceof CoreJourneyNotFoundError) return;
    throw new Error(`${label} query is incompatible with the migrated PostgreSQL schema`, { cause: error });
  }
  throw new Error(`${label} unexpectedly found the reserved verification UUID`);
}

try {
  await expectEmptyButValid('Rider core-journey', () => getCoreJourneyProgress(pool, bookingId, actor));
  await expectEmptyButValid('Driver core-journey', () => getDriverCoreJourneyProgress(pool, bookingId, actor));
  await expectEmptyButValid('Control Room core-journey', () => getControlRoomCoreJourneyProgress(pool, bookingId, handoverId, actor));
  console.log('DAZAT core-journey PostgreSQL query verification PASSED');
} finally {
  await pool.end();
}

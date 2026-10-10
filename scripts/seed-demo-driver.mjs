// Test-environment seeding only. Makes ONE already-registered Driver dispatch-eligible
// for 30 days so the Rider -> Driver -> Control Room slice can be demonstrated.
// It writes the same compliance/fleet rows the Core Journey HTTP verifier writes.
// It does not touch payments, communications or any provider switch.
//
// Usage (DATABASE_URL = the Render *External* database URL, set in your own shell):
//   node scripts/seed-demo-driver.mjs <driverProfileId>
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const driverProfileId = process.argv[2];
if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!driverProfileId || !/^[0-9a-f-]{36}$/i.test(driverProfileId)) {
  throw new Error('Usage: node scripts/seed-demo-driver.mjs <driverProfileId>');
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('BEGIN');
  const profile = await client.query('SELECT id FROM driver.driver_profile WHERE id = $1', [driverProfileId]);
  if (!profile.rowCount) throw new Error('No such driver profile. Register the Driver through the API first.');

  const existing = await client.query(
    `SELECT vehicle_id FROM driver.driver_vehicle_authorisation
      WHERE driver_profile_id = $1 AND status = 'ACTIVE' AND valid_until > now() + interval '1 day'`,
    [driverProfileId]
  );
  if (existing.rowCount) {
    await client.query('ROLLBACK');
    console.log(JSON.stringify({ alreadySeeded: true, vehicleId: existing.rows[0].vehicle_id }));
    process.exit(0);
  }

  const id = () => randomUUID();
  const vehicleId = id(), planId = id(), planVersionId = id(), requirementId = id(), driverSnapshotId = id();
  const regMark = `DM${Math.floor(Math.random() * 90 + 10)} DEMO`;
  const ref = 'demo-seed';

  // Onboarding approval is a governed record, not a status flip: application + append-only history +
  // authorised decision by someone other than the Driver + a satisfied requirement. All committed together.
  const priorApplication = await client.query('SELECT 1 FROM driver.driver_application WHERE driver_profile_id = $1', [driverProfileId]);
  if (priorApplication.rowCount) throw new Error('This Driver already has an application; seed is for fresh demo Drivers only.');
  const reviewer = await client.query('INSERT INTO identity.person DEFAULT VALUES RETURNING id');
  const reviewerPersonId = reviewer.rows[0].id;
  const applicationId = id(), requirementDefinitionId = id();
  const decidedAt = new Date().toISOString();
  await client.query(`INSERT INTO driver.driver_application (id, driver_profile_id, status, version, policy_version, submitted_at, decided_at, decision_reason_code) VALUES ($1,$2,'APPROVED',1,'demo-seed',$3,$3,'DEMO_SEED_APPROVAL')`, [applicationId, driverProfileId, decidedAt]);
  await client.query(`INSERT INTO driver.driver_application_transition (driver_application_id, from_status, to_status, version, command_id, actor_type, actor_id, reason_code) VALUES ($1,NULL,'APPROVED',1,$2,'AUTHORISED_STAFF',$3,'DEMO_SEED_APPROVAL')`, [applicationId, id(), reviewerPersonId]);
  await client.query(`INSERT INTO driver.driver_application_decision (driver_application_id, decision, decision_authority_type, reviewer_person_id, reason_code, evidence_summary, policy_version, decided_at) VALUES ($1,'APPROVED','AUTHORISED_STAFF',$2,'DEMO_SEED_APPROVAL','{"note":"test-environment demo seed"}'::jsonb,'demo-seed',$3)`, [applicationId, reviewerPersonId, decidedAt]);
  await client.query(`INSERT INTO compliance.requirement_definition (id, requirement_code, version, region_code, service_code, evidence_kind, high_risk, valid_from, policy_reference) VALUES ($1,$2,1,'GB-LON','STANDARD','OTHER',false,now() - interval '1 hour','demo-seed')`, [requirementDefinitionId, `DEMO_SEED_${applicationId.slice(0, 8)}`]);
  await client.query(`INSERT INTO compliance.driver_requirement_status (driver_application_id, requirement_definition_id, status, evidence_references, evaluated_by_authority, evaluated_at, valid_until) VALUES ($1,$2,'SATISFIED','["demo-seed-requirement"]'::jsonb,'DEMO_SEED',now(),now() + interval '30 days')`, [applicationId, requirementDefinitionId]);
  await client.query(`UPDATE driver.driver_profile SET onboarding_status = 'APPROVED' WHERE id = $1`, [driverProfileId]);
  await client.query(`INSERT INTO vehicle_fleet.vehicle (id, registration_mark, lifecycle_status) VALUES ($1,$2,'ACTIVE')`, [vehicleId, regMark]);
  await client.query(`INSERT INTO driver.driver_vehicle_authorisation (id, driver_profile_id, vehicle_id, status, valid_from, valid_until) VALUES ($1,$2,$3,'ACTIVE',now() - interval '1 hour',now() + interval '30 days')`, [id(), driverProfileId, vehicleId]);
  await client.query(`INSERT INTO compliance.driver_vehicle_insurance_validation (id, driver_profile_id, vehicle_id, status, insurer_reference, policy_reference, evidence_references, verification_authority, valid_until) VALUES ($1,$2,$3,'ELIGIBLE',$4,$4,$5,'CI_VERIFIER',now() + interval '30 days')`, [id(), driverProfileId, vehicleId, ref, JSON.stringify([`${ref}-insurance`])]);
  await client.query(`INSERT INTO compliance.driver_eligibility_snapshot (id, driver_profile_id, status, policy_version, evidence_references, valid_until) VALUES ($1,$2,'ELIGIBLE','demo-seed',$3,now() + interval '30 days')`, [driverSnapshotId, driverProfileId, JSON.stringify([`${ref}-driver`])]);
  await client.query(`INSERT INTO compliance.vehicle_eligibility_snapshot (id, vehicle_id, status, policy_version, service_capabilities, evidence_references, valid_until) VALUES ($1,$2,'ELIGIBLE','demo-seed','{}',$3,now() + interval '30 days')`, [id(), vehicleId, JSON.stringify([`${ref}-vehicle`])]);
  await client.query(`INSERT INTO driver.driver_permission (id, driver_profile_id, region_code, service_code, status, risk_tier, source_type, source_reference_id, policy_version, valid_from, valid_until) VALUES ($1,$2,'GB-LON','STANDARD','ACTIVE','STANDARD','COMPLIANCE_REVIEW',$3,'demo-seed',now() - interval '1 hour',now() + interval '30 days')`, [id(), driverProfileId, driverSnapshotId]);
  await client.query(`INSERT INTO vehicle_fleet.vehicle_maintenance_plan (id, vehicle_id) VALUES ($1,$2)`, [planId, vehicleId]);
  await client.query(`INSERT INTO vehicle_fleet.vehicle_maintenance_plan_version (id, maintenance_plan_id, version, status, source_types, source_references, policy_version, effective_from, effective_until) VALUES ($1,$2,1,'ACTIVE',ARRAY['DAZAT_POLICY']::vehicle_fleet.maintenance_plan_source[],$3,'demo-seed',now() - interval '1 hour',now() + interval '30 days')`, [planVersionId, planId, JSON.stringify([`${ref}-plan`])]);
  await client.query(`INSERT INTO vehicle_fleet.maintenance_requirement (id, plan_version_id, requirement_code, description, source_type, source_reference, due_at, evidence_references) VALUES ($1,$2,'DAILY_CHECK','Daily operational check','DAZAT_POLICY','demo-seed',now() + interval '30 days',$3)`, [requirementId, planVersionId, JSON.stringify([`${ref}-requirement`])]);
  await client.query(`INSERT INTO vehicle_fleet.maintenance_requirement_evaluation (id, maintenance_requirement_id, status, urgency, evidence_references, evaluated_by_authority, policy_version) VALUES ($1,$2,'OPEN','ROUTINE',$3,'CI_VERIFIER','demo-seed')`, [id(), requirementId, JSON.stringify([`${ref}-evaluation`])]);

  await client.query('COMMIT');
  console.log(JSON.stringify({ seeded: true, driverProfileId, vehicleId, registrationMark: regMark, validDays: 30 }));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}

import type { FleetAgreementProjection, FleetMarketplaceOfferProjection, VehicleAssignmentValidationProjection } from '@dazat/contracts';
import { evaluateVehicleAssignmentPermission, type VehicleAccessRoute, type FleetTier, type FleetVehicleState } from '@dazat/domain';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';
import { getDriverOperatingEligibilityProjection } from '../driver-operations/driver-operations-service.js';

export class FleetOperationsNotFoundError extends Error {}
export class FleetOperationsForbiddenError extends Error {}

interface MarketplaceRow {
  offer_id: string;
  offer_family_id: string;
  version: number;
  vehicle_id: string;
  region_code: string;
  access_route: VehicleAccessRoute;
  tier: FleetTier;
  periodic_charge_minor: string | number;
  total_contract_cost_minor: string | number;
  deposit_minor: string | number;
  currency: string;
  billing_interval: FleetMarketplaceOfferProjection['billingInterval'];
  term_days: number | null;
  mileage_terms: Record<string, unknown>;
  end_of_term_conditions: string[];
  included_services: string[];
  excluded_services: string[];
  ownership_transfer_terms: string[] | null;
  supplier_stock_verified_at: Date;
  warranty_verified_at: Date;
}

function safeMinorUnit(value: string | number, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${field} exceeds safe minor-unit bounds`);
  return parsed;
}

function marketplaceProjection(row: MarketplaceRow): FleetMarketplaceOfferProjection {
  return {
    offerId: row.offer_id,
    offerFamilyId: row.offer_family_id,
    version: Number(row.version),
    vehicleId: row.vehicle_id,
    regionCode: row.region_code,
    accessRoute: row.access_route,
    tier: row.tier,
    periodicChargeMinor: safeMinorUnit(row.periodic_charge_minor, 'periodicChargeMinor'),
    totalContractCostMinor: safeMinorUnit(row.total_contract_cost_minor, 'totalContractCostMinor'),
    depositMinor: safeMinorUnit(row.deposit_minor, 'depositMinor'),
    currency: row.currency,
    billingInterval: row.billing_interval,
    ...(row.term_days ? { termDays: row.term_days } : {}),
    mileageTerms: row.mileage_terms,
    endOfTermConditions: row.end_of_term_conditions,
    includedServices: row.included_services,
    excludedServices: row.excluded_services,
    ...(row.ownership_transfer_terms?.length ? { ownershipTransferTerms: row.ownership_transfer_terms } : {}),
    supplierTermsVerifiedAt: new Date(Math.min(
      row.supplier_stock_verified_at.getTime(), row.warranty_verified_at.getTime()
    )).toISOString(),
    genericDiscountClaim: false
  };
}

const MARKETPLACE_SELECT = `SELECT offer_id, offer_family_id, version, vehicle_id, region_code,
       access_route, tier, periodic_charge_minor, total_contract_cost_minor, deposit_minor,
       currency, billing_interval, term_days, mileage_terms, end_of_term_conditions, included_services,
       excluded_services, ownership_transfer_terms, supplier_stock_verified_at, warranty_verified_at
  FROM vehicle_fleet.current_marketplace_offer`;

export async function listCurrentFleetMarketplaceOffers(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  regionCode: string
): Promise<readonly FleetMarketplaceOfferProjection[]> {
  if (!actor.driverProfileId) throw new FleetOperationsForbiddenError('A Driver profile is required');
  const result = await pool.query<MarketplaceRow>(
    `${MARKETPLACE_SELECT} WHERE region_code = $1 ORDER BY total_contract_cost_minor, offer_id LIMIT 100`,
    [regionCode]
  );
  return result.rows.map(marketplaceProjection);
}

export async function getCurrentFleetMarketplaceOffer(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  offerId: string
): Promise<FleetMarketplaceOfferProjection> {
  if (!actor.driverProfileId) throw new FleetOperationsForbiddenError('A Driver profile is required');
  const result = await pool.query<MarketplaceRow>(`${MARKETPLACE_SELECT} WHERE offer_id = $1`, [offerId]);
  if (!result.rowCount) throw new FleetOperationsNotFoundError('Current Fleet Marketplace offer not found');
  return marketplaceProjection(result.rows[0]!);
}

export async function listCurrentDriverFleetAgreements(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<readonly FleetAgreementProjection[]> {
  if (!actor.driverProfileId) throw new FleetOperationsForbiddenError('A Driver profile is required');
  const result = await pool.query<{
    agreement_id: string;
    agreement_version_id: string;
    version: number;
    vehicle_id: string;
    access_route: FleetAgreementProjection['accessRoute'];
    status: FleetAgreementProjection['status'];
    effective_from: Date;
    effective_until: Date | null;
  }>(
    `SELECT agreement_id, agreement_version_id, version, vehicle_id, access_route, status, effective_from, effective_until
       FROM vehicle_fleet.current_fleet_agreement WHERE driver_profile_id = $1
       ORDER BY effective_from DESC, agreement_id`,
    [actor.driverProfileId]
  );
  return result.rows.map((row) => ({
    agreementId: row.agreement_id,
    agreementVersionId: row.agreement_version_id,
    version: Number(row.version),
    vehicleId: row.vehicle_id,
    accessRoute: row.access_route,
    status: row.status,
    effectiveFrom: row.effective_from.toISOString(),
    ...(row.effective_until ? { effectiveUntil: row.effective_until.toISOString() } : {}),
    depositIsPlatformRevenue: false
  }));
}

export async function validateDriverVehicleAssignment(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  vehicleId: string,
  regionCode: string,
  replacementForAssignmentId: string | null
): Promise<VehicleAssignmentValidationProjection> {
  if (!actor.driverProfileId) throw new FleetOperationsForbiddenError('A Driver profile is required');
  const operating = await getDriverOperatingEligibilityProjection(pool, actor, regionCode, vehicleId);
  const result = await pool.query<{
    fleet_state: FleetVehicleState;
    driver_vehicle_authorised: boolean;
    insurance_status: string | null;
    insurance_valid_until: Date | null;
    vehicle_status: string | null;
    vehicle_valid_until: Date | null;
    capability_valid_until: Date | null;
    agreement_active: boolean;
    external_tenancy: boolean;
    external_tenancy_active: boolean;
    maintenance_plan_current: boolean | null;
    maintenance_operating_permitted: boolean | null;
  }>(
    `SELECT vehicle.fleet_state,
            EXISTS (
              SELECT 1 FROM driver.current_driver_vehicle_authorisation authorisation
               WHERE authorisation.driver_profile_id = $1 AND authorisation.vehicle_id = $2
            ) AS driver_vehicle_authorised,
            insurance.status AS insurance_status, insurance.valid_until AS insurance_valid_until,
            vehicle_eligibility.status AS vehicle_status, vehicle_eligibility.valid_until AS vehicle_valid_until,
            capability.valid_until AS capability_valid_until,
            maintenance.active_plan_present AS maintenance_plan_current,
            maintenance.operating_permitted AS maintenance_operating_permitted,
            EXISTS (
              SELECT 1 FROM vehicle_fleet.current_fleet_agreement agreement
               WHERE agreement.driver_profile_id = $1 AND agreement.vehicle_id = $2 AND agreement.status = 'ACTIVE'
                 AND agreement.effective_from <= now()
                 AND (agreement.effective_until IS NULL OR agreement.effective_until > now())
            ) AS agreement_active,
            EXISTS (
              SELECT 1 FROM vehicle_fleet.vehicle_tenancy tenancy
              JOIN vehicle_fleet.fleet_organisation organisation ON organisation.id = tenancy.fleet_organisation_id
               WHERE tenancy.vehicle_id = $2 AND tenancy.valid_from <= now()
                 AND (tenancy.valid_until IS NULL OR tenancy.valid_until > now())
                 AND organisation.tenancy_type = 'EXTERNAL_FLEET'
            ) AS external_tenancy,
            NOT EXISTS (
              SELECT 1 FROM vehicle_fleet.vehicle_tenancy tenancy
              JOIN vehicle_fleet.fleet_organisation organisation ON organisation.id = tenancy.fleet_organisation_id
               WHERE tenancy.vehicle_id = $2 AND tenancy.valid_from <= now()
                 AND (tenancy.valid_until IS NULL OR tenancy.valid_until > now())
                 AND organisation.tenancy_type = 'EXTERNAL_FLEET'
                 AND organisation.status <> 'ACTIVE'
            ) AS external_tenancy_active
       FROM vehicle_fleet.vehicle vehicle
       LEFT JOIN compliance.current_driver_vehicle_insurance insurance
         ON insurance.driver_profile_id = $1 AND insurance.vehicle_id = vehicle.id
       LEFT JOIN LATERAL (
         SELECT status, valid_until FROM compliance.vehicle_eligibility_snapshot snapshot
          WHERE snapshot.vehicle_id = vehicle.id ORDER BY snapshot.evaluated_at DESC LIMIT 1
       ) vehicle_eligibility ON true
       LEFT JOIN vehicle_fleet.current_vehicle_capability capability ON capability.vehicle_id = vehicle.id
       LEFT JOIN vehicle_fleet.current_vehicle_maintenance_gate maintenance ON maintenance.vehicle_id = vehicle.id
      WHERE vehicle.id = $2`,
    [actor.driverProfileId, vehicleId]
  );
  if (!result.rowCount) throw new FleetOperationsNotFoundError('Vehicle not found');
  const row = result.rows[0]!;
  const now = new Date();
  const pairInsuranceCurrent = row.insurance_status === 'ELIGIBLE'
    && Boolean(row.insurance_valid_until && row.insurance_valid_until.getTime() > now.getTime());
  const vehicleEligible = row.vehicle_status === 'ELIGIBLE'
    && Boolean(row.vehicle_valid_until && row.vehicle_valid_until.getTime() > now.getTime())
    && row.maintenance_operating_permitted === true;
  const capabilitiesExplicit = Boolean(row.capability_valid_until && row.capability_valid_until.getTime() > now.getTime());
  const decision = evaluateVehicleAssignmentPermission({
    driverOperatingEligible: operating.status !== 'NOT_ELIGIBLE',
    driverVehicleAuthorised: row.driver_vehicle_authorised,
    pairInsuranceCurrent,
    vehicleEligible,
    fleetState: row.fleet_state,
    agreementActive: row.agreement_active,
    validationCurrent: true,
    externalFleetOrganisation: row.external_tenancy,
    externalFleetOrganisationActive: row.external_tenancy_active,
    capabilitiesExplicitAndCurrent: capabilitiesExplicit
  });
  return {
    driverProfileId: actor.driverProfileId,
    vehicleId,
    ...(replacementForAssignmentId ? { replacementForAssignmentId } : {}),
    assignable: decision.assignable,
    blockers: decision.blockers,
    pairInsuranceCurrent,
    capabilitiesExplicit,
    maintenancePlanCurrent: row.maintenance_plan_current === true,
    maintenanceOperatingPermitted: row.maintenance_operating_permitted === true,
    externalFleetOrganisation: row.external_tenancy,
    externalFleetOrganisationActive: row.external_tenancy_active,
    externalTenancyBypassAllowed: false,
    replacementRequiresFreshValidation: true,
    source: 'AUTHORITATIVE_CURRENT_PROJECTION',
    evaluatedAt: now.toISOString()
  };
}

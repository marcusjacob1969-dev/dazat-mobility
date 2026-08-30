export interface DriverApplicationProjection {
  readonly applicationId: string;
  readonly driverProfileId: string;
  readonly status: 'STARTED' | 'CONTACT_VERIFIED' | 'IDENTITY_PENDING' | 'DOCUMENTS_PENDING' | 'TRAINING_PENDING' | 'VEHICLE_PENDING' | 'REVIEW_PENDING' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED';
  readonly version: number;
  readonly nextAction: 'CONTACT_VERIFICATION_REQUIRED' | 'IDENTITY_VERIFICATION_REQUIRED' | 'DOCUMENTS_REQUIRED' | 'TRAINING_REQUIRED' | 'VEHICLE_REQUIRED' | 'AUTHORISED_REVIEW_REQUIRED' | 'NONE';
  readonly approvalGranted: boolean;
  readonly operatingEligibilityGranted: false;
  readonly externalVerificationConfigured: false;
  readonly ocrMayApproveCompliance: false;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DriverOperatingEligibilityProjection {
  readonly driverProfileId: string;
  readonly selectedVehicleId?: string;
  readonly status: 'ELIGIBLE' | 'PARTIALLY_ELIGIBLE' | 'NOT_ELIGIBLE';
  readonly eligibleServiceCodes: readonly string[];
  readonly activeRestrictionScopes: readonly string[];
  readonly blockers: readonly string[];
  readonly maintenanceOperatingPermitted: boolean;
  readonly maintenanceRestrictedServiceCodes: readonly string[];
  readonly availabilityEvaluatedSeparately: true;
  readonly source: 'AUTHORITATIVE_CURRENT_PROJECTION';
  readonly evaluatedAt: string;
}

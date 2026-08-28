export type AccountStatus = 'PENDING' | 'ACTIVE' | 'LIMITED' | 'SUSPENDED' | 'CLOSED';
export type ProfileKind = 'RIDER' | 'DRIVER' | 'BOTH';
export type RegistrationContactType = 'EMAIL' | 'MOBILE';

export interface StartAccountRegistrationRequest {
  readonly profileKind: ProfileKind;
  readonly preferredName: string;
  readonly contact: {
    readonly type: RegistrationContactType;
    readonly value: string;
  };
}

export interface StartAccountRegistrationCommand extends StartAccountRegistrationRequest {
  readonly idempotencyKey: string;
  readonly commandId: string;
}

export interface AccountRegistrationResult {
  readonly accountId: string;
  readonly riderProfileId?: string;
  readonly driverProfileId?: string;
  readonly accountStatus: 'PENDING';
  readonly nextAction: 'CONTACT_VERIFICATION_REQUIRED';
  readonly contact: {
    readonly id: string;
    readonly type: RegistrationContactType;
    readonly displayHint: string;
    readonly verificationStatus: 'UNVERIFIED';
  };
}

export interface StartContactVerificationRequest {
  readonly accountId: string;
  readonly contactPointId: string;
}

export interface StartContactVerificationResult {
  readonly verificationId: string;
  readonly status: 'PENDING';
  readonly contact: {
    readonly id: string;
    readonly type: RegistrationContactType;
    readonly displayHint: string;
  };
  readonly expiresAt: string;
  readonly resendAvailableAt: string;
  readonly deliveryState: 'DELIVERED' | 'UNKNOWN';
  /** Development-only escape hatch. Never enabled in production. */
  readonly developmentCode?: string;
}

export interface DeviceContextInput {
  readonly deviceInstanceId: string;
  readonly platform?: string;
  readonly appInstallationId?: string;
}

export interface ConfirmContactVerificationRequest {
  readonly verificationId: string;
  readonly code: string;
  readonly device?: DeviceContextInput;
}

export interface AuthenticatedSessionResult {
  readonly accountId: string;
  readonly accountStatus: 'ACTIVE' | 'LIMITED';
  readonly session: {
    readonly id: string;
    readonly bearerToken: string;
    readonly authStrength: 'VERIFIED_CONTACT' | 'PASSKEY' | 'STEP_UP';
    readonly expiresAt: string;
  };
  readonly nextAction: 'AUTHENTICATED';
}

export interface CurrentSessionSummary {
  readonly accountId: string;
  readonly personId: string;
  readonly accountStatus: AccountStatus;
  readonly sessionId: string;
  readonly authStrength: string;
  readonly expiresAt: string;
  readonly riderProfileId?: string;
  readonly driverProfileId?: string;
}

export interface IdentitySecuritySummary {
  readonly accountId: string;
  readonly accountStatus: AccountStatus;
  readonly activeSessionCount: number;
  readonly recognisedDeviceCount: number;
  readonly activePasskeyCount: number;
}

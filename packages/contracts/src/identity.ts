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

export interface IdentitySecuritySummary {
  readonly accountId: string;
  readonly accountStatus: AccountStatus;
  readonly activeSessionCount: number;
  readonly recognisedDeviceCount: number;
  readonly activePasskeyCount: number;
}

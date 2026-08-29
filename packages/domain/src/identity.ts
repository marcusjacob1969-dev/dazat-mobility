export const ACCOUNT_STATUSES = ['PENDING', 'ACTIVE', 'LIMITED', 'SUSPENDED', 'CLOSED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const PROFILE_KINDS = ['RIDER', 'DRIVER', 'BOTH'] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];

export const CONTACT_POINT_TYPES = ['EMAIL', 'MOBILE', 'LANDLINE'] as const;
export type ContactPointType = (typeof CONTACT_POINT_TYPES)[number];

export const AUTHENTICATOR_TYPES = ['PASSKEY', 'PASSWORD', 'VERIFIED_CONTACT', 'FUTURE_FACTOR'] as const;
export type AuthenticatorType = (typeof AUTHENTICATOR_TYPES)[number];

export const AUTHENTICATOR_STATUSES = ['PENDING', 'ACTIVE', 'REVOKED'] as const;
export type AuthenticatorStatus = (typeof AUTHENTICATOR_STATUSES)[number];

export const DEVICE_TRUST_STATUSES = ['UNKNOWN', 'RECOGNISED', 'TRUSTED', 'RESTRICTED', 'REVOKED'] as const;
export type DeviceTrustStatus = (typeof DEVICE_TRUST_STATUSES)[number];

export const SESSION_STATUSES = ['ACTIVE', 'STEP_UP_REQUIRED', 'REVOKED', 'EXPIRED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const RECOVERY_STATES = [
  'STARTED',
  'IDENTITY_ASSESSMENT',
  'CONTACT_ASSESSMENT',
  'STEP_UP_REQUIRED',
  'REVIEW_REQUIRED',
  'RECOVERY_APPROVED',
  'SECURITY_RESET',
  'RECOVERY_COMPLETE',
  'DECLINED',
  'ABANDONED',
  'LOCKED_FOR_REVIEW'
] as const;
export type RecoveryState = (typeof RECOVERY_STATES)[number];


const recoveryTransitions: Readonly<Record<RecoveryState, readonly RecoveryState[]>> = {
  STARTED: ['IDENTITY_ASSESSMENT', 'ABANDONED', 'LOCKED_FOR_REVIEW'],
  IDENTITY_ASSESSMENT: ['CONTACT_ASSESSMENT', 'STEP_UP_REQUIRED', 'REVIEW_REQUIRED', 'DECLINED', 'LOCKED_FOR_REVIEW'],
  CONTACT_ASSESSMENT: ['STEP_UP_REQUIRED', 'REVIEW_REQUIRED', 'RECOVERY_APPROVED', 'DECLINED', 'LOCKED_FOR_REVIEW'],
  STEP_UP_REQUIRED: ['RECOVERY_APPROVED', 'REVIEW_REQUIRED', 'DECLINED', 'LOCKED_FOR_REVIEW'],
  REVIEW_REQUIRED: ['RECOVERY_APPROVED', 'DECLINED', 'LOCKED_FOR_REVIEW'],
  RECOVERY_APPROVED: ['SECURITY_RESET'],
  SECURITY_RESET: ['RECOVERY_COMPLETE', 'LOCKED_FOR_REVIEW'],
  RECOVERY_COMPLETE: [],
  DECLINED: [],
  ABANDONED: [],
  LOCKED_FOR_REVIEW: ['IDENTITY_ASSESSMENT', 'REVIEW_REQUIRED', 'DECLINED']
};

export function canTransitionRecoveryState(from: RecoveryState, to: RecoveryState): boolean {
  return recoveryTransitions[from].includes(to);
}

export function isSessionAuthoritative(status: SessionStatus, expiresAt: Date, now: Date = new Date()): boolean {
  return status === 'ACTIVE' && expiresAt.getTime() > now.getTime();
}
export const ACCOUNT_CAPABILITIES = [
  'VIEW_PROFILE',
  'EDIT_PROFILE',
  'BOOK_RIDE',
  'ACTIVE_JOURNEY',
  'SAFETY',
  'SUPPORT',
  'VIEW_FINANCIAL_HISTORY',
  'PREPARE_PAYMENT',
  'CHANGE_SECURITY',
  'CHANGE_PAYOUT'
] as const;
export type AccountCapability = (typeof ACCOUNT_CAPABILITIES)[number];

const accountTransitions: Readonly<Record<AccountStatus, readonly AccountStatus[]>> = {
  PENDING: ['ACTIVE', 'LIMITED', 'SUSPENDED', 'CLOSED'],
  ACTIVE: ['LIMITED', 'SUSPENDED', 'CLOSED'],
  LIMITED: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
  SUSPENDED: ['ACTIVE', 'LIMITED', 'CLOSED'],
  CLOSED: []
};

export function canTransitionAccountStatus(from: AccountStatus, to: AccountStatus): boolean {
  return accountTransitions[from].includes(to);
}

export function canUseAccountCapability(status: AccountStatus, capability: AccountCapability): boolean {
  if (status === 'CLOSED' || status === 'SUSPENDED') return capability === 'SUPPORT';
  if (status === 'PENDING') return capability === 'SUPPORT' || capability === 'CHANGE_SECURITY';
  if (status === 'ACTIVE') return true;

  // LIMITED preserves essential service/safety/support access while holding risky changes.
  return [
    'VIEW_PROFILE',
    'BOOK_RIDE',
    'ACTIVE_JOURNEY',
    'SAFETY',
    'SUPPORT',
    'VIEW_FINANCIAL_HISTORY'
  ].includes(capability);
}

export function normaliseContact(type: ContactPointType, rawValue: string): string {
  const value = rawValue.trim();
  if (type === 'EMAIL') {
    const normalised = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) throw new Error('Invalid email address');
    return normalised;
  }

  // Registration phone contacts use canonical E.164. Local display formatting belongs in clients.
  const compact = value.replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) throw new Error('Phone number must be E.164');
  return compact;
}

export function maskContact(type: ContactPointType, normalisedValue: string): string {
  if (type === 'EMAIL') {
    const at = normalisedValue.indexOf('@');
    if (at <= 0) return '***';
    const local = normalisedValue.slice(0, at);
    const domain = normalisedValue.slice(at + 1);
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
  }

  const tail = normalisedValue.slice(-4);
  return `••••${tail}`;
}

export function profileKinds(kind: ProfileKind): readonly ('RIDER' | 'DRIVER')[] {
  return kind === 'BOTH' ? ['RIDER', 'DRIVER'] : [kind];
}

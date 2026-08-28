export type OpaqueId<Brand extends string> = string & { readonly __brand: Brand };

export type PersonId = OpaqueId<'PersonId'>;
export type UserAccountId = OpaqueId<'UserAccountId'>;
export type RiderProfileId = OpaqueId<'RiderProfileId'>;
export type DriverProfileId = OpaqueId<'DriverProfileId'>;
export type BookingId = OpaqueId<'BookingId'>;
export type CommandId = OpaqueId<'CommandId'>;
export type CorrelationId = OpaqueId<'CorrelationId'>;
export type ContactPointId = OpaqueId<'ContactPointId'>;
export type AuthenticatorId = OpaqueId<'AuthenticatorId'>;
export type DeviceTrustRecordId = OpaqueId<'DeviceTrustRecordId'>;
export type SessionId = OpaqueId<'SessionId'>;
export type AccountRecoveryCaseId = OpaqueId<'AccountRecoveryCaseId'>;

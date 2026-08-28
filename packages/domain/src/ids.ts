export type OpaqueId<Brand extends string> = string & { readonly __brand: Brand };

export type PersonId = OpaqueId<'PersonId'>;
export type UserAccountId = OpaqueId<'UserAccountId'>;
export type RiderProfileId = OpaqueId<'RiderProfileId'>;
export type DriverProfileId = OpaqueId<'DriverProfileId'>;
export type BookingId = OpaqueId<'BookingId'>;
export type CommandId = OpaqueId<'CommandId'>;
export type CorrelationId = OpaqueId<'CorrelationId'>;

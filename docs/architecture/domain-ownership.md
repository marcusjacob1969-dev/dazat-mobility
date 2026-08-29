# Canonical domain ownership map

| Domain | Initial aggregate roots / owned facts |
|---|---|
| Identity | Person, UserAccount, authentication/session ownership |
| Rider | RiderProfile |
| Driver | DriverProfile, operating state |
| Compliance | DriverComplianceProfile, VehicleComplianceProfile |
| Vehicle/Fleet | Vehicle, FleetAgreement |
| Booking | Booking, BookingParty, BookingRequirement, BookingStateTransition |
| Pricing | Quote, FareAgreement |
| Dispatch | DispatchAttempt, DriverOffer, DriverAssignment |
| Journey | Journey, JourneyLeg, RideCheckSession |
| Safety | SafetyEvent, SafeguardingCase |
| Operations | OperationalCase, ControlRoomTask |
| Finance | PaymentIntent, Payment, Refund, FinancialAccount, LedgerTransaction, DriverEarning, Payout, Invoice |
| Communications | CommunicationRequest, ContactCase |
| Organisation | Organisation, OrganisationAgreement |
| School | SchoolPassengerProfile, SchoolTransportSeries |
| Rescue | BreakdownEvent, ContinuityCase, RescueCase |
| Shield | SecurityEvent, AccountRecoveryCase |
| Policy/Configuration | PolicyVersion, RegionConfiguration |

## Rule

A logical reference to another domain's ID is not write authority. Read models may combine projections, but mutations return to the owning domain.

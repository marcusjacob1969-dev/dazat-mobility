# Canonical domain ownership map

| Domain | Initial aggregate roots / owned facts |
|---|---|
| Identity | Person, UserAccount, authentication/session ownership |
| Rider | RiderProfile |
| Driver | DriverProfile, DriverApplication, TrainingModule/Record, DriverPermission, DriverRestriction, MaintenanceComplianceAssessment, DriverPerksProgramme, operating/availability state |
| Compliance | RequirementDefinition, DriverDocument/VerificationReview, DriverComplianceProfile, VehicleComplianceProfile |
| Vehicle/Fleet | FleetOrganisation, Vehicle, VehicleCapability, MarketplaceOffer, FleetAgreement, VehicleFinanceAgreement, DepositObligation, VehicleHandoverRecord, VehicleAssignment, VehicleMaintenancePlan, MaintenanceRequirement, VehicleDefect, VehicleRestriction, MaintenanceCase, Repair/ReturnToService, VehicleReplacementRequest, VehicleReliabilityObservation |
| Booking | Booking, BookingParty, BookingRequirement, BookingStateTransition |
| Pricing | Quote, FareAgreement |
| Dispatch | DispatchAttempt, DriverOffer, DriverAssignment |
| Journey | Journey, JourneyLeg, RideCheckSession |
| Safety | SafetyEvent, SafeguardingCase |
| Operations | OperationalCase, ControlRoomTask |
| Finance | PaymentIntent, Payment, Refund, FinancialAccount, LedgerTransaction, DriverEarning, Payout, Invoice |
| Communications | Communication, CommunicationTemplateVersion, CommunicationPreferenceVersion, CommunicationDeliveryPlan, MessageDelivery, CommunicationAcknowledgement, ProtectedConversation, MaskedCallSession, ChannelHealthObservation, CallSession, CallerIdentityAssessment, ContactPlanVersion, VoiceDialogueSession, VoiceFieldCapture, TelephoneBookingSession, CallTransfer, CallbackRequest, SecurePaymentHandoff, CallRecording, CallTranscript, InterpreterSession, NotificationPolicyVersion, DeliveryPolicyVersion, CommunicationRequest, CanonicalEventEnvelope, CommunicationEventContractVersion, CommunicationApiContractVersion, CommunicationP0RequirementVersion, CommunicationRequestContract, RecipientPermissionResolution, DeliveryPathResolution, CommunicationsDegradedModeDecision, ContactCase, CommunicationFailureCase, CriticalAcknowledgementRequirement, CommunicationSLO, ChannelProviderProfile/Health, ProviderOutageResponsePlan, CommunicationsScenario, CommunicationAcceptanceCase, CommunicationLaunchGateEvidence |
| Organisation | Organisation, OrganisationLifecycleTransition, OrganisationLegalProfileVersion, OrganisationSite, CostCentreVersion, OrganisationContactVersion, OrganisationRole, OrganisationUserMembership, OrganisationPermissionGrantVersion, OrganisationInvitation, OrganisationRestriction, OrganisationServicePolicyVersion, OrganisationAgreement/Version/StatusEvent, OrganisationPricingScheduleVersion, OrganisationBillingPolicyVersion, BillingAccount, FundingReference, PurchaseOrderReference, ReportingPolicyVersion, ServiceLevelPolicyVersion/Measurement, PerformanceCausationAssessment, OrganisationServiceCase, CorrectiveActionPlan, ContractChangeRequest, ContractPolicySimulation/Impact, OrganisationCreditStatus/Event/Override, FutureBookingContractClassification, OrganisationMigrationBatch/Row, OrganisationReinstatementAssessment, OrganisationCommunicationPolicyVersion, ManagedPassengerProfile, OrganisationPassengerMembership, PassengerAuthorisedContactVersion, ServiceEligibilityProfileVersion, FundingAuthorisationVersion, BookingAuthorityRuleVersion, BookingFundingInstruction, BookingTemplateVersion, BookingSeries/Amendment/Occurrence, SchoolCalendarVersion/Date, ScheduledPickupWindow, PassengerReadinessEvent, InstitutionalCapacityReservation, DriverScheduleConflictAssessment, BulkPassengerImportBatch, BulkBookingBatch, PassengerSubstitutionDecision, InstitutionalCancellationDecision, OrganisationTransportException, InstitutionalBookingProvenance, OrganisationApprovalPolicyVersion/Request, OrganisationSupportCase, OrganisationApiClient/CredentialVersion, OrganisationWebhookSubscription/Delivery, OrganisationExportRequest, OrganisationAuditEvent |
| School | SchoolPassengerProfile, SchoolTransportSeries |
| Rescue | BreakdownEvent, ContinuityCase, RescueCase |
| Shield | SecurityEvent, AccountRecoveryCase |
| Policy/Configuration | PolicyVersion, RegionConfiguration |

## Rule

A logical reference to another domain's ID is not write authority. Read models may combine projections, but mutations return to the owning domain. Communications may transport and describe another domain's current versioned truth; it cannot calculate, decide or mutate that truth.

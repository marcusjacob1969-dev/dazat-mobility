import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dazatTokens } from '@dazat/design-system';
import type { ActiveJourneyProjection, ArrivalCommunicationPlanProjection, CommunicationInboxProjection, CommunicationsOperationsCapabilitiesProjection, CommunicationsOperationsStatusProjection, ContactCaseListProjection, ContactPlanProjection, ConnectivityReconciliationProjection, DriverAppealSubjectType, DriverApplicationProjection, DriverDailyOperationsProjection, DriverEarningsProjection, DriverEligibilitySummary, DriverFairTreatmentProjection, DriverIncentiveProjection, DriverOfferSummary, DriverOperatingEligibilityProjection, DriverSupplyProjection, DriverSupportCaseProjection, DriverSupportCategory, FleetAgreementProjection, FleetMarketplaceOfferProjection, PreShiftCheckProjection, RegistrationContactType, RiderConductCaseProjection, SubmitDriverAppealProjection, TelephonyInteractionListProjection, TelephonyServiceCapabilitiesProjection, VehicleAssignmentValidationProjection, VehicleMaintenanceProjection, VerifiedDriverPerkProjection, VerifyRideCheckResult } from '@dazat/contracts';
import {
  confirmDriverContactVerification,
  startDriverContactVerification,
  startDriverRegistration
} from './src/identity-api';
import {
  acceptDriverOffer,
  declineDriverOffer,
  getDriverEligibility,
  listDriverOffers,
  setDriverAvailability
} from './src/dispatch-api';
import {
  acknowledgeAssignment,
  beginJourney,
  completeActiveJourney,
  getDriverJourney,
  markDestinationArriving,
  markArrived,
  sendActiveJourneyLocation,
  sendDriverSos,
  sendPickupLocation,
  verifyPickupRideCheck
} from './src/journey-api';
import { readDriverEarnings } from './src/finance-api';
import { readDriverOperatingEligibility, startOrResumeDriverApplication } from './src/driver-operations-api';
import { listDriverFleetAgreements, listFleetMarketplace, validateVehicleAssignment } from './src/fleet-operations-api';
import { listVerifiedDriverPerks, readVehicleMaintenance, submitPreShiftCheck } from './src/maintenance-reliability-api';
import { listDriverIncentives, readDriverFairTreatment, submitAppeal, submitRiderConductCase, terminateUnsafeJourney } from './src/driver-fair-treatment-api';
import { listSupportCases, openSupportCase, readArrivalPlan, readDriverDailyOperations, readSupplyDemand, reconcileConnectivity } from './src/driver-daily-operations-api';
import { readCommunicationInbox } from './src/communications-api';
import { readContactPlan, readTelephonyCapabilities, readTelephonyInteractions } from './src/telephony-voice-api';
import { readCommunicationsOperationsCapabilities, readCommunicationsOperationsStatus, readContactCases } from './src/communications-operations-api';

type Flow = 'REGISTER' | 'VERIFY' | 'DRIVER_HOME';

function rideCheckOutcomeText(result: VerifyRideCheckResult): string {
  if (result.verified) return 'Passenger verified.';
  if (result.status === 'LOCKED') return 'RideCheck locked and protected-start hold opened. This is not a misconduct finding.';
  if (result.status === 'EXPIRED') return 'RideCheck expired. The Journey remains protected and cannot start.';
  return `RideCheck PIN did not match: ${result.attemptsRemaining} attempts remaining. This is not a misconduct finding.`;
}

function formatMinorUnits(amountMinor: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(amountMinor / (10 ** fractionDigits));
}

function clientUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function DriverApp() {
  const [flow, setFlow] = useState<Flow>('REGISTER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [contactType, setContactType] = useState<RegistrationContactType>('EMAIL');
  const [contact, setContact] = useState('');
  const [accountId, setAccountId] = useState('');
  const [contactPointId, setContactPointId] = useState('');
  const [displayHint, setDisplayHint] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [regionCode, setRegionCode] = useState('MANCHESTER');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [eligibility, setEligibility] = useState<DriverEligibilitySummary | null>(null);
  const [availability, setAvailability] = useState('OFFLINE');
  const [offers, setOffers] = useState<readonly DriverOfferSummary[]>([]);
  const [assignment, setAssignment] = useState('');
  const [assignedBookingId, setAssignedBookingId] = useState('');
  const [journey, setJourney] = useState<ActiveJourneyProjection | null>(null);
  const [rideCheckCode, setRideCheckCode] = useState('');
  const [rideCheckOutcome, setRideCheckOutcome] = useState<VerifyRideCheckResult | null>(null);
  const [safetyStatus, setSafetyStatus] = useState('');
  const [earnings, setEarnings] = useState<DriverEarningsProjection | null>(null);
  const [driverApplication, setDriverApplication] = useState<DriverApplicationProjection | null>(null);
  const [operatingEligibility, setOperatingEligibility] = useState<DriverOperatingEligibilityProjection | null>(null);
  const [fleetOffers, setFleetOffers] = useState<readonly FleetMarketplaceOfferProjection[]>([]);
  const [fleetAgreements, setFleetAgreements] = useState<readonly FleetAgreementProjection[]>([]);
  const [assignmentValidation, setAssignmentValidation] = useState<VehicleAssignmentValidationProjection | null>(null);
  const [maintenance, setMaintenance] = useState<VehicleMaintenanceProjection | null>(null);
  const [preShiftResult, setPreShiftResult] = useState<PreShiftCheckProjection | null>(null);
  const [odometer, setOdometer] = useState('');
  const [vehicleConcern, setVehicleConcern] = useState('');
  const [verifiedPerks, setVerifiedPerks] = useState<readonly VerifiedDriverPerkProjection[]>([]);
  const [fairTreatment, setFairTreatment] = useState<DriverFairTreatmentProjection | null>(null);
  const [driverIncentives, setDriverIncentives] = useState<readonly DriverIncentiveProjection[]>([]);
  const [riderConductDetails, setRiderConductDetails] = useState('');
  const [riderConductCase, setRiderConductCase] = useState<RiderConductCaseProjection | null>(null);
  const [appealSubjectType, setAppealSubjectType] = useState<DriverAppealSubjectType>('DRIVER_RESTRICTION');
  const [appealSubjectId, setAppealSubjectId] = useState('');
  const [appealStatement, setAppealStatement] = useState('');
  const [appealResult, setAppealResult] = useState<SubmitDriverAppealProjection | null>(null);
  const [dailyOperations, setDailyOperations] = useState<DriverDailyOperationsProjection | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityReconciliationProjection | null>(null);
  const [supplyDemand, setSupplyDemand] = useState<DriverSupplyProjection | null>(null);
  const [supportCases, setSupportCases] = useState<readonly DriverSupportCaseProjection[]>([]);
  const [supportCategory, setSupportCategory] = useState<DriverSupportCategory>('TECHNICAL');
  const [supportSummary, setSupportSummary] = useState('');
  const [arrivalPlan, setArrivalPlan] = useState<ArrivalCommunicationPlanProjection | null>(null);
  const [communicationInbox, setCommunicationInbox] = useState<CommunicationInboxProjection | null>(null);
  const [telephonyCapabilities, setTelephonyCapabilities] = useState<TelephonyServiceCapabilitiesProjection | null>(null);
  const [contactPlan, setContactPlan] = useState<ContactPlanProjection | null>(null);
  const [telephonyInteractions, setTelephonyInteractions] = useState<TelephonyInteractionListProjection | null>(null);
  const [communicationsOperationsCapabilities, setCommunicationsOperationsCapabilities] = useState<CommunicationsOperationsCapabilitiesProjection | null>(null);
  const [contactCases, setContactCases] = useState<ContactCaseListProjection | null>(null);
  const [communicationsOperationsStatus, setCommunicationsOperationsStatus] = useState<CommunicationsOperationsStatusProjection | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The current step could not be completed.'); }
    finally { setBusy(false); }
  }

  function createAccount() {
    void run(async () => {
      const result = await startDriverRegistration({ profileKind: 'DRIVER', preferredName, contact: { type: contactType, value: contact } });
      setAccountId(result.accountId);
      setContactPointId(result.contact.id);
      setDisplayHint(result.contact.displayHint);
      setFlow('VERIFY');
    });
  }

  function sendCode() {
    void run(async () => {
      const result = await startDriverContactVerification(accountId, contactPointId);
      setVerificationId(result.verificationId);
      setDevelopmentCode(result.developmentCode ?? '');
    });
  }

  function verify() {
    void run(async () => {
      const result = await confirmDriverContactVerification({ verificationId, code: verificationCode });
      setSessionToken(result.session.bearerToken);
      setFlow('DRIVER_HOME');
    });
  }

  function checkEligibility() {
    void run(async () => setEligibility(await getDriverEligibility(sessionToken, regionCode, vehicleId || undefined)));
  }

  function startApplication() {
    void run(async () => setDriverApplication(await startOrResumeDriverApplication(sessionToken)));
  }

  function checkOperatingEligibility() {
    void run(async () => setOperatingEligibility(await readDriverOperatingEligibility(sessionToken, regionCode, vehicleId || undefined)));
  }

  function refreshDailyOperationsTruth() {
    void run(async () => {
      const [daily, supply, cases] = await Promise.all([
        readDriverDailyOperations(sessionToken),
        readSupplyDemand(sessionToken, regionCode, operatingEligibility?.eligibleServiceCodes ?? []),
        listSupportCases(sessionToken)
      ]);
      setDailyOperations(daily);
      setSupplyDemand(supply);
      setSupportCases(cases);
      setAvailability(daily.availabilityStatus);
    });
  }

  function reconcileAuthoritativeState() {
    void run(async () => {
      const result = await reconcileConnectivity(sessionToken, {
        clientObservationId: clientUuid(),
        networkReachable: true,
        observedAt: new Date().toISOString(),
        ...(connectivity?.reconciledAt ? { lastServerSyncAt: connectivity.reconciledAt } : {}),
        ...(dailyOperations && dailyOperations.availabilityVersion > 0
          ? { knownAvailabilityVersion: dailyOperations.availabilityVersion }
          : {}),
        ...(dailyOperations?.activeJourneyId ? { knownActiveJourneyId: dailyOperations.activeJourneyId } : {}),
        ...(dailyOperations?.activeJourneyVersion ? { knownActiveJourneyVersion: dailyOperations.activeJourneyVersion } : {}),
        queuedCriticalEvents: []
      });
      setConnectivity(result);
      setDailyOperations(await readDriverDailyOperations(sessionToken));
    });
  }

  function changeWorkIntent(status: 'AVAILABLE' | 'BREAK' | 'FINISHING_SOON') {
    void run(async () => {
      const request = status === 'BREAK'
        ? { status } as const
        : {
            status,
            regionCode,
            vehicleId,
            location: {
              latitude: Number(latitude), longitude: Number(longitude), observedAt: new Date().toISOString(),
              source: 'DEVICE_GPS' as const, confidence: 0.9
            }
          };
      const result = await setDriverAvailability(sessionToken, request);
      setAvailability(result.status);
      setEligibility(result.eligibility);
      setDailyOperations(await readDriverDailyOperations(sessionToken));
    });
  }

  function createSupportCase() {
    void run(async () => {
      if (!supportSummary.trim()) throw new Error('Describe what help you need.');
      await openSupportCase(sessionToken, {
        category: supportCategory,
        summaryReference: supportSummary.trim(),
        ...(journey ? { journeyId: journey.journeyId, bookingId: journey.bookingId } : {}),
        ...(['SAFETY', 'BREAKDOWN', 'FLEET'].includes(supportCategory) && vehicleId ? { vehicleId } : {}),
        immediateDanger: supportCategory === 'SAFETY' && Boolean(journey),
        serviceContinuityAtRisk: ['SAFETY', 'BREAKDOWN'].includes(supportCategory) && Boolean(journey)
      });
      setSupportSummary('');
      setSupportCases(await listSupportCases(sessionToken));
      setDailyOperations(await readDriverDailyOperations(sessionToken));
    });
  }

  function refreshFleetTruth() {
    void run(async () => {
      const [offersResult, agreementsResult] = await Promise.all([
        listFleetMarketplace(sessionToken, regionCode),
        listDriverFleetAgreements(sessionToken)
      ]);
      setFleetOffers(offersResult);
      setFleetAgreements(agreementsResult);
      if (vehicleId) setAssignmentValidation(await validateVehicleAssignment(sessionToken, regionCode, vehicleId));
      else setAssignmentValidation(null);
    });
  }

  function refreshMaintenanceTruth() {
    if (!vehicleId) return;
    void run(async () => {
      const [maintenanceResult, perksResult] = await Promise.all([
        readVehicleMaintenance(sessionToken, vehicleId, operatingEligibility?.eligibleServiceCodes ?? ['STANDARD']),
        listVerifiedDriverPerks(sessionToken, regionCode)
      ]);
      setMaintenance(maintenanceResult);
      setVerifiedPerks(perksResult);
    });
  }

  function recordPreShift(concern: boolean) {
    if (!vehicleId) return;
    void run(async () => {
      const parsedOdometer = Number(odometer);
      if (!Number.isSafeInteger(parsedOdometer) || parsedOdometer < 0) throw new Error('Enter the current whole-number odometer reading.');
      const result = await submitPreShiftCheck(sessionToken, vehicleId, {
        occurredAt: new Date().toISOString(),
        odometer: parsedOdometer,
        items: {
          TYRES: 'PASS', LIGHTS: 'PASS', BRAKES: 'PASS', STEERING: 'PASS',
          MIRRORS: 'PASS', SEATBELTS: 'PASS', WARNING_INDICATORS: concern ? 'NOT_SURE' : 'PASS',
          ACCESSIBILITY_EQUIPMENT: 'PASS'
        },
        ...(concern ? { uncertainConcernText: vehicleConcern.trim() || 'Something does not feel right.' } : {})
      });
      setPreShiftResult(result);
      setMaintenance(await readVehicleMaintenance(sessionToken, vehicleId, operatingEligibility?.eligibleServiceCodes ?? ['STANDARD']));
    });
  }

  function refreshFairTreatment() {
    void run(async () => {
      const [treatment, incentives] = await Promise.all([
        readDriverFairTreatment(sessionToken),
        listDriverIncentives(sessionToken, regionCode)
      ]);
      setFairTreatment(treatment);
      setDriverIncentives(incentives);
    });
  }

  function reportRiderConduct(terminate: boolean) {
    if (!journey) return;
    void run(async () => {
      const reportReference = riderConductDetails.trim();
      if (!reportReference) throw new Error('Describe the unsafe or unacceptable conduct in your own words.');
      const request = { categories: ['DANGEROUS_BEHAVIOUR'] as const, reportReference, immediateDanger: terminate };
      const result = terminate
        ? await terminateUnsafeJourney(sessionToken, journey.journeyId, request)
        : await submitRiderConductCase(sessionToken, { journeyId: journey.journeyId, ...request });
      setRiderConductCase(result);
      if (terminate) {
        setAvailability('BREAK');
        setSafetyStatus('Unsafe Journey terminated · Safety case and passenger continuity persisted · rating protected');
      }
    });
  }

  function submitDriverDecisionAppeal() {
    void run(async () => {
      if (!appealSubjectId.trim() || !appealStatement.trim()) throw new Error('Enter the decision ID and your appeal statement.');
      setAppealResult(await submitAppeal(sessionToken, {
        subjectType: appealSubjectType,
        subjectId: appealSubjectId.trim(),
        reasonCategory: 'PROCEDURAL_FAIRNESS',
        statementReference: appealStatement.trim()
      }));
      setFairTreatment(await readDriverFairTreatment(sessionToken));
    });
  }

  function goOnline() {
    void run(async () => {
      const result = await setDriverAvailability(sessionToken, {
        status: 'AVAILABLE',
        regionCode,
        vehicleId,
        location: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          observedAt: new Date().toISOString(),
          source: 'DEVICE_GPS',
          confidence: 0.9
        }
      });
      setAvailability(result.status);
      setEligibility(result.eligibility);
      setDailyOperations(await readDriverDailyOperations(sessionToken));
    });
  }

  function goOffline() {
    void run(async () => {
      const result = await setDriverAvailability(sessionToken, { status: 'OFFLINE' });
      setAvailability(result.status);
      setEligibility(result.eligibility);
      setOffers([]);
      setDailyOperations(await readDriverDailyOperations(sessionToken));
    });
  }

  function refreshOffers() {
    void run(async () => setOffers(await listDriverOffers(sessionToken)));
  }

  function accept(offerId: string) {
    void run(async () => {
      const result = await acceptDriverOffer(sessionToken, offerId);
      setAssignment(result.assignmentId);
      setAssignedBookingId(result.bookingId);
      setAvailability('ASSIGNED');
      setOffers([]);
      setArrivalPlan(await readArrivalPlan(sessionToken, result.bookingId));
    });
  }

  function acknowledge() {
    if (!assignedBookingId) return;
    void run(async () => {
      const result = await acknowledgeAssignment(sessionToken, assignedBookingId);
      setJourney(await getDriverJourney(sessionToken, result.journeyId));
    });
  }

  function sendLocation() {
    if (!journey) return;
    void run(async () => {
      if (['IN_PROGRESS', 'ARRIVING'].includes(journey.journeyStatus)) {
        await sendActiveJourneyLocation(sessionToken, journey.journeyId, Number(latitude), Number(longitude));
      } else {
        await sendPickupLocation(sessionToken, journey.journeyId, Number(latitude), Number(longitude));
      }
      setJourney(await getDriverJourney(sessionToken, journey.journeyId));
    });
  }

  function refreshJourney() {
    if (!journey) return;
    void run(async () => setJourney(await getDriverJourney(sessionToken, journey.journeyId)));
  }

  function arrive() {
    if (!journey) return;
    void run(async () => {
      await markArrived(sessionToken, journey.journeyId);
      setJourney(await getDriverJourney(sessionToken, journey.journeyId));
    });
  }

  function verifyRideCheck() {
    if (!journey?.rideCheckSessionId) return;
    void run(async () => {
      setRideCheckOutcome(await verifyPickupRideCheck(sessionToken, journey.journeyId, journey.rideCheckSessionId!, rideCheckCode));
      setJourney(await getDriverJourney(sessionToken, journey.journeyId));
    });
  }

  function startProtectedJourney() {
    if (!journey) return;
    void run(async () => {
      await beginJourney(sessionToken, journey.journeyId);
      setJourney(await getDriverJourney(sessionToken, journey.journeyId));
    });
  }

  function sendSos() {
    if (!journey) return;
    void run(async () => {
      const result = await sendDriverSos(sessionToken, journey.journeyId);
      setSafetyStatus(`SOS persisted · ${result.journeyHealth}`);
      setJourney(await getDriverJourney(sessionToken, journey.journeyId));
    });
  }

  function markDestinationApproach() {
    if (!journey) return;
    void run(async () => {
      await markDestinationArriving(sessionToken, journey.journeyId);
      setJourney(await getDriverJourney(sessionToken, journey.journeyId));
    });
  }

  function finishJourney() {
    if (!journey) return;
    void run(async () => {
      await completeActiveJourney(sessionToken, journey.journeyId);
      setAvailability('AVAILABLE');
      setJourney(await getDriverJourney(sessionToken, journey.journeyId));
    });
  }

  function refreshEarnings() {
    void run(async () => setEarnings(await readDriverEarnings(sessionToken)));
  }

  function decline(offerId: string) {
    void run(async () => {
      await declineDriverOffer(sessionToken, offerId);
      setOffers((current) => current.filter((offer) => offer.offerId !== offerId));
    });
  }

  function refreshCommunications() {
    void run(async () => setCommunicationInbox(await readCommunicationInbox(sessionToken)));
  }

  function refreshTelephoneAccessTruth() {
    void run(async () => {
      const [capabilities, plan, interactions] = await Promise.all([
        readTelephonyCapabilities(), readContactPlan(sessionToken), readTelephonyInteractions(sessionToken)
      ]);
      setTelephonyCapabilities(capabilities);
      setContactPlan(plan);
      setTelephonyInteractions(interactions);
    });
  }

  function refreshCommunicationsOperationsTruth() {
    void run(async () => {
      const [capabilities, cases, status] = await Promise.all([
        readCommunicationsOperationsCapabilities(), readContactCases(sessionToken),
        readCommunicationsOperationsStatus(sessionToken)
      ]);
      setCommunicationsOperationsCapabilities(capabilities);
      setContactCases(cases);
      setCommunicationsOperationsStatus(status);
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>ENGINEERING PHASE 0.15</Text>
        <Text style={styles.title}>DAZAT Driver journey</Text>
        <Text style={styles.body}>Authentication does not make a driver eligible; all hard checks must pass before Dispatch. The complete Driver day keeps secure session, approved vehicle, eligibility, scheduled work, informed offers, pickup, RideCheck, Journey, earnings, break, finishing-soon and end-shift truth separate. Weak-signal recovery replaces speculative state and never pretends queued Safety commands were already processed.</Text>

        {flow === 'REGISTER' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Create Driver account</Text>
            <Field label="Preferred name" value={preferredName} onChangeText={setPreferredName} />
            <View style={styles.row}>
              {(['EMAIL', 'MOBILE'] as const).map((type) => (
                <Pressable key={type} onPress={() => { setContactType(type); setContact(''); }} style={[styles.secondaryButton, contactType === type && styles.selected]}>
                  <Text style={styles.secondaryText}>{type === 'EMAIL' ? 'Email' : 'Mobile'}</Text>
                </Pressable>
              ))}
            </View>
            <Field label={contactType === 'EMAIL' ? 'Email address' : 'Mobile number'} value={contact} onChangeText={setContact} />
            <PrimaryButton busy={busy} label="Create Driver account" onPress={createAccount} />
          </View>
        ) : null}

        {flow === 'VERIFY' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Verify {displayHint}</Text>
            {!verificationId ? <PrimaryButton busy={busy} label="Send verification code" onPress={sendCode} /> : (
              <>
                {developmentCode ? <Text style={styles.devNotice}>Development-only code: {developmentCode}</Text> : null}
                <Field label="Six-digit verification code" value={verificationCode} onChangeText={setVerificationCode} />
                <PrimaryButton busy={busy} label="Verify Driver account" onPress={verify} />
              </>
            )}
          </View>
        ) : null}

        {flow === 'DRIVER_HOME' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver readiness</Text>
            <View style={styles.notice} accessibilityRole="summary">
              <Text style={styles.noticeTitle}>Driver application: {driverApplication?.status ?? 'NOT STARTED'}</Text>
              <Text style={styles.body}>{driverApplication
                ? `Next action: ${driverApplication.nextAction}. Application approval never grants operating eligibility by itself.`
                : 'Start a resumable application. Contact verification is recognised, but identity, documents, assessed training, vehicle and authorised review remain separate.'}</Text>
              <PrimaryButton busy={busy} label="Start or resume Driver application" onPress={startApplication} />
              <Text style={styles.devNotice}>OCR CANNOT APPROVE COMPLIANCE · DRIVER SELF-APPROVAL DISABLED</Text>
            </View>
            <Text style={styles.status}>Availability: {availability}</Text>
            <Field label="Authorised vehicle ID" value={vehicleId} onChangeText={setVehicleId} />
            <Field label="Region" value={regionCode} onChangeText={setRegionCode} />
            <Field label="Current latitude" value={latitude} onChangeText={setLatitude} />
            <Field label="Current longitude" value={longitude} onChangeText={setLongitude} />
            <View style={styles.row}>
              <SecondaryButton label="Check operating permission truth" onPress={checkOperatingEligibility} />
              <SecondaryButton label="Check eligibility" onPress={checkEligibility} />
              {availability === 'OFFLINE' ? <SecondaryButton label="Go online" onPress={goOnline} /> : availability !== 'ASSIGNED' ? <SecondaryButton label="Go offline" onPress={goOffline} /> : null}
            </View>
            {operatingEligibility ? (
              <View style={styles.notice} accessibilityRole="summary">
                <Text style={styles.noticeTitle}>Operating eligibility: {operatingEligibility.status}</Text>
                <Text style={styles.body}>{operatingEligibility.blockers.length
                  ? operatingEligibility.blockers.join(', ')
                  : `Permitted services: ${operatingEligibility.eligibleServiceCodes.join(', ')}`}</Text>
                <Text style={styles.body}>Availability is evaluated separately. A permission never makes the Driver online.</Text>
              </View>
            ) : null}
            <View style={styles.notice} accessibilityRole="summary">
              <Text style={styles.noticeTitle}>Daily operations, work intent and weak-signal truth</Text>
              <Text style={styles.body}>BREAK and FINISHING_SOON are normal work states, not misconduct. OFFLINE stops ordinary Driver-app location collection. Voice readout, CarPlay and Android Auto remain unconfigured roadmaps; voice can never bypass backend validation.</Text>
              <View style={styles.row}>
                <SecondaryButton label="Refresh authoritative daily state" onPress={refreshDailyOperationsTruth} />
                <SecondaryButton label="Reconcile after weak signal" onPress={reconcileAuthoritativeState} />
              </View>
              {dailyOperations ? (
                <>
                  <Text style={styles.status}>Work intent: {dailyOperations.availabilityStatus} · version {dailyOperations.availabilityVersion}</Text>
                  <Text style={styles.body}>Shift: {dailyOperations.shiftId ?? 'not active'} · scheduled commitments: {dailyOperations.scheduledWork.length} · open offers: {dailyOperations.openOfferCount}</Text>
                  <Text style={styles.body}>Connectivity: {dailyOperations.connectivity.state} · speculative state trusted: NO · ordinary app location: {dailyOperations.ordinaryAppLocationCollectionActive ? 'ACTIVE' : 'STOPPED'}</Text>
                  <Text style={styles.body}>Posted earnings: {dailyOperations.postedEarningCount} · open support cases: {dailyOperations.openSupportCaseCount}</Text>
                  {dailyOperations.scheduledWork.map((commitment) => <Text key={commitment.commitmentId} style={styles.body}>
                    Scheduled {commitment.serviceCode}: {commitment.scheduledFor} · accepted commitment protected from conflicting work
                  </Text>)}
                </>
              ) : null}
              {connectivity ? <Text style={connectivity.authoritativeSnapshotRequired ? styles.error : styles.status}>
                Reconciliation {connectivity.state} · queued events executed automatically: NO · {connectivity.authoritativeSnapshotRequired ? 'replace speculative state' : 'authoritative state aligned'}
              </Text> : null}
              {availability !== 'ASSIGNED' && availability !== 'OFFLINE' ? (
                <View style={styles.row}>
                  {availability !== 'BREAK' ? <SecondaryButton label="Take a normal break" onPress={() => changeWorkIntent('BREAK')} /> : null}
                  {availability !== 'FINISHING_SOON' ? <SecondaryButton label="Finishing soon" onPress={() => changeWorkIntent('FINISHING_SOON')} /> : null}
                  {availability !== 'AVAILABLE' ? <SecondaryButton label="Resume available" onPress={() => changeWorkIntent('AVAILABLE')} /> : null}
                </View>
              ) : null}
              <Text style={styles.noticeTitle}>Capability-based supply — never guaranteed earnings</Text>
              <Text style={styles.body}>Current observation and forecast remain visibly separate. WAV, School and other capability supply are not hidden inside a raw Driver count.</Text>
              {supplyDemand?.signals.length ? supplyDemand.signals.map((signal) => <Text key={signal.observationId} style={styles.body}>
                {signal.kind}: {signal.capabilityCode} · demand {signal.demandCount} · eligible supply {signal.eligibleSupplyCount} · confidence {signal.confidence} · guaranteed earnings NO
              </Text>) : <Text style={styles.body}>No evidence-backed supply signal is currently published.</Text>}
              <Text style={styles.noticeTitle}>Driver Support</Text>
              <View style={styles.row}>
                {(['SAFETY', 'BREAKDOWN', 'PAYMENTS', 'ACCOUNT', 'COMPLIANCE', 'TECHNICAL', 'PASSENGER', 'FLEET'] as const).map((category) => (
                  <Pressable key={category} onPress={() => setSupportCategory(category)} style={[styles.secondaryButton, supportCategory === category && styles.selected]}>
                    <Text style={styles.secondaryText}>{category}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="What help do you need?" value={supportSummary} onChangeText={setSupportSummary} />
              <SecondaryButton label="Open Driver Support case" onPress={createSupportCase} />
              {supportCases.map((supportCase) => <Text key={supportCase.supportCaseId} style={supportCase.humanEscalationRequired ? styles.error : styles.body}>
                {supportCase.category}: {supportCase.status} · risk {supportCase.risk} · human escalation {supportCase.humanEscalationRequired ? 'REQUIRED' : 'not required'} · external service contacted NO
              </Text>)}
            </View>
            <View style={styles.notice} accessibilityRole="summary">
              <Text style={styles.noticeTitle}>Fleet Marketplace and assignment truth</Text>
              <Text style={styles.body}>Supplier stock, warranty, total cost, deposit, term, mileage and end-of-term terms must be verified. DAZAT does not promise a generic discount.</Text>
              <Text style={styles.body}>Deposits are not platform revenue. Vehicle capability is explicit, and replacement assignment re-runs Driver, vehicle, insurance, agreement and permission checks.</Text>
              <SecondaryButton label="Refresh Fleet truth" onPress={refreshFleetTruth} />
              <Text style={styles.body}>Current offers: {fleetOffers.length} · agreements: {fleetAgreements.length}</Text>
              {fleetOffers.map((offer) => (
                <View key={offer.offerId} style={styles.section}>
                  <Text style={styles.noticeTitle}>{offer.accessRoute} · {offer.tier}</Text>
                  <Text style={styles.body}>Total cost {formatMinorUnits(offer.totalContractCostMinor, offer.currency)} · deposit {formatMinorUnits(offer.depositMinor, offer.currency)}</Text>
                  <Text style={styles.body}>Charge {formatMinorUnits(offer.periodicChargeMinor, offer.currency)} · {offer.billingInterval} · term {offer.termDays ?? 'not applicable'} days</Text>
                  <Text style={styles.body}>Included: {offer.includedServices.length ? offer.includedServices.join(', ') : 'None stated'} · excluded: {offer.excludedServices.length ? offer.excludedServices.join(', ') : 'None stated'}</Text>
                  <Text style={styles.body}>Mileage: {JSON.stringify(offer.mileageTerms)} · end conditions: {offer.endOfTermConditions.join(', ')}</Text>
                  {offer.ownershipTransferTerms ? <Text style={styles.body}>Ownership transfer: {offer.ownershipTransferTerms.join(', ')}</Text> : null}
                  <Text style={styles.body}>Supplier terms verified {offer.supplierTermsVerifiedAt}.</Text>
                </View>
              ))}
              {fleetAgreements.map((agreement) => (
                <Text key={agreement.agreementId} style={styles.body}>
                  Agreement {agreement.agreementId}: {agreement.accessRoute} · {agreement.status} · version {agreement.version}
                </Text>
              ))}
              {assignmentValidation ? <Text style={assignmentValidation.assignable ? styles.status : styles.error}>
                Assignment {assignmentValidation.assignable ? 'VALIDATED' : `BLOCKED: ${assignmentValidation.blockers.join(', ')}`}
              </Text> : null}
            </View>
            <View style={styles.notice} accessibilityRole="summary">
              <Text style={styles.noticeTitle}>Vehicle maintenance and pre-shift check</Text>
              <Text style={styles.body}>You can report “something does not feel right” without diagnosing a fault. Safety concerns stop vehicle use for review and do not create a Driver fault finding.</Text>
              <SecondaryButton label="Refresh maintenance and verified perks" onPress={refreshMaintenanceTruth} />
              {maintenance ? (
                <>
                  <Text style={maintenance.operatingPermitted ? styles.status : styles.error}>
                    Vehicle use {maintenance.operatingPermitted ? 'PERMITTED' : `BLOCKED: ${maintenance.blockers.join(', ')}`}
                  </Text>
                  <Text style={styles.body}>Plan: {maintenance.activePlanPresent ? 'current' : 'missing'} · urgency: {maintenance.highestUrgency ?? 'none'} · open defects: {maintenance.openDefectCount}</Text>
                  <Text style={maintenance.unresolvedSafetyCriticalRecall ? styles.error : styles.body}>Safety-critical recall: {maintenance.unresolvedSafetyCriticalRecall ? 'UNRESOLVED — vehicle use blocked' : 'none unresolved'}</Text>
                  <Text style={styles.body}>Restricted services: {maintenance.restrictedServiceCodes.length ? maintenance.restrictedServiceCodes.join(', ') : 'none'}</Text>
                </>
              ) : null}
              <Field label="Current odometer" value={odometer} onChangeText={setOdometer} />
              <Field label="Concern in your own words (no diagnosis needed)" value={vehicleConcern} onChangeText={setVehicleConcern} />
              <View style={styles.row}>
                <SecondaryButton label="Record all-clear pre-shift" onPress={() => recordPreShift(false)} />
                <SecondaryButton label="Report something feels wrong" onPress={() => recordPreShift(true)} />
              </View>
              {preShiftResult ? <Text style={preShiftResult.vehicleUsePermitted ? styles.status : styles.error}>
                Check {preShiftResult.outcome} · use {preShiftResult.vehicleUsePermitted ? 'permitted' : 'stopped for review'} · no Driver fault finding
              </Text> : null}
              <Text style={styles.body}>Verified current perks: {verifiedPerks.length}</Text>
              {verifiedPerks.map((perk) => <Text key={perk.perkOfferId} style={styles.body}>
                {perk.category} · {perk.programmeName}: {perk.benefitTerms.join(', ')}
              </Text>)}
            </View>
            <View style={styles.notice} accessibilityRole="summary">
              <Text style={styles.noticeTitle}>Fair treatment — separate evidence, no hidden score</Text>
              <Text style={styles.body}>Ratings are feedback, not findings. Allegation, evidence, your response, assessment, finding and action remain separate. Ordinary offer declines never reduce hidden Dispatch priority.</Text>
              <SecondaryButton label="Refresh fair-treatment and incentive truth" onPress={refreshFairTreatment} />
              {fairTreatment ? (
                <>
                  <Text style={styles.status}>Opaque Driver Score: NOT USED</Text>
                  <Text style={styles.body}>Ratings: {fairTreatment.dimensions.ratingFeedbackCount} · open complaints: {fairTreatment.dimensions.openComplaintCount} · findings: {fairTreatment.dimensions.substantiatedFindingCount}</Text>
                  <Text style={styles.body}>Active restrictions: {fairTreatment.dimensions.activeRestrictionCount} · open appeals: {fairTreatment.dimensions.openAppealCount} · Driver protection cases: {fairTreatment.dimensions.openRiderConductCaseCount}</Text>
                  {fairTreatment.complaints.map((complaint) => <Text key={complaint.complaintId} style={styles.body}>
                    Complaint {complaint.complaintId}: {complaint.status} · allegation is not a finding
                  </Text>)}
                  {fairTreatment.restrictions.map((restriction) => <Text key={restriction.restrictionId} style={styles.body}>
                    Restriction {restriction.scope}: {restriction.restrictionBasis} · narrowest safe scope · not guilt
                  </Text>)}
                </>
              ) : null}
              <Text style={styles.body}>Finance-approved incentives: {driverIncentives.length}. Incentives stay separate from base earnings, unsafe fatigue pressure and secret priority boosts.</Text>
              {driverIncentives.map((incentive) => <Text key={incentive.programmeVersionId} style={styles.body}>
                {incentive.title} · v{incentive.version} · {incentive.qualification?.outcome ?? 'not yet evaluated'} · dispute route available
              </Text>)}
              <Text style={styles.noticeTitle}>Appeal a high-impact decision</Text>
              <View style={styles.row}>
                {(['COMPLAINT_FINDING', 'DRIVER_RESTRICTION', 'OFFBOARDING_DECISION', 'INCENTIVE_QUALIFICATION'] as const).map((subjectType) => (
                  <Pressable key={subjectType} onPress={() => setAppealSubjectType(subjectType)} style={[styles.secondaryButton, appealSubjectType === subjectType && styles.selected]}>
                    <Text style={styles.secondaryText}>{subjectType.replaceAll('_', ' ')}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="Decision or restriction ID" value={appealSubjectId} onChangeText={setAppealSubjectId} />
              <Field label="Appeal statement" value={appealStatement} onChangeText={setAppealStatement} />
              <SecondaryButton label="Submit for independent review" onPress={submitDriverDecisionAppeal} />
              {appealResult ? <Text style={styles.status}>Appeal {appealResult.appealId} submitted. Original decision history is preserved.</Text> : null}
            </View>
            {eligibility ? (
              <View style={styles.notice} accessibilityRole="summary">
                <Text style={styles.noticeTitle}>{eligibility.eligible ? 'Eligible for Dispatch' : 'Not eligible for Dispatch'}</Text>
                <Text style={styles.body}>{eligibility.blockers.length ? eligibility.blockers.join(', ') : 'All Dispatch hard filters passed.'}</Text>
              </View>
            ) : null}
            <PrimaryButton busy={busy} label="Refresh job offers" onPress={refreshOffers} />
            {offers.map((offer) => (
              <View key={offer.offerId} style={styles.notice}>
                <Text style={styles.noticeTitle}>{offer.pickup.displayLabel} → {offer.dropoff.displayLabel}</Text>
                <Text style={styles.body}>Services: {offer.disclosure.serviceCodes.join(', ') || 'not disclosed'} · context: {offer.disclosure.journeyContextLabels.join(', ') || 'not disclosed'}</Text>
                <Text style={styles.body}>Provisional straight-line pickup distance: {offer.disclosure.pickupDistanceMetres ?? 'unavailable'} m · route ETA: {offer.disclosure.pickupEta.status === 'AVAILABLE' ? `${offer.disclosure.pickupEta.minutes} minutes` : 'not configured'}</Text>
                <Text style={offer.disclosure.expectedEarning.status === 'VERIFIED_ESTIMATE' ? styles.status : styles.error}>Expected earning: {offer.disclosure.expectedEarning.status === 'VERIFIED_ESTIMATE'
                  ? formatMinorUnits(offer.disclosure.expectedEarning.amountMinor!, offer.disclosure.expectedEarning.currency!)
                  : 'not available until Finance-approved Driver earning policy exists'}</Text>
                <Text style={offer.disclosure.informedChoiceReady ? styles.status : styles.error}>Informed choice: {offer.disclosure.informedChoiceReady ? 'READY' : `BLOCKED — ${offer.disclosure.missingDisclosures.join(', ')}`}</Text>
                <Text style={styles.body}>Expires {offer.expiresAt}. Declining or letting this expire is not an ordinary acceptance-rate punishment.</Text>
                <View style={styles.row}>
                  {offer.disclosure.acceptanceAllowed ? <PrimaryButton busy={busy} label="Accept this offer" onPress={() => accept(offer.offerId)} /> : null}
                  <SecondaryButton label="Decline without penalty" onPress={() => decline(offer.offerId)} />
                </View>
              </View>
            ))}
            {assignment ? (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>Atomic assignment confirmed</Text>
                <Text style={styles.body}>{assignment}</Text>
                {arrivalPlan ? (
                  <View style={styles.section}>
                    <Text style={styles.noticeTitle}>Chosen Booking pickup — not assumed passenger GPS</Text>
                    <Text style={styles.body}>{arrivalPlan.pickup.displayLabel} · plan {arrivalPlan.planStatus}</Text>
                    <Text style={styles.body}>Channels: {arrivalPlan.channels.join(', ') || 'not configured'} · recipients: {arrivalPlan.recipientRoles.join(', ') || 'not configured'} · direct contact details exposed NO</Text>
                  </View>
                ) : null}
                {!journey ? <PrimaryButton busy={busy} label="Acknowledge and navigate to pickup" onPress={acknowledge} /> : (
                  <>
                    <Text style={styles.status}>Journey: {journey.journeyStatus}</Text>
                    <Text style={styles.body}>Telemetry: {journey.latestDriverLocation?.telemetryState ?? 'UNKNOWN'} · Hold: {journey.activeOperationalHold ? 'ACTIVE' : 'NONE'}</Text>
                    <SecondaryButton label="Refresh authoritative Journey state" onPress={refreshJourney} />
                    <SecondaryButton label={['IN_PROGRESS', 'ARRIVING'].includes(journey.journeyStatus) ? 'Send active Journey location' : 'Send fresh pickup location'} onPress={sendLocation} />
                    {journey.journeyStatus === 'EN_ROUTE' ? <PrimaryButton busy={busy} label="Mark arrived with evidence" onPress={arrive} /> : null}
                    {journey.journeyStatus === 'AWAITING_RIDECHECK' ? (
                      <>
                        <Field label="Passenger's six-digit RideCheck" value={rideCheckCode} onChangeText={setRideCheckCode} />
                        <PrimaryButton busy={busy} label="Verify passenger pairing" onPress={verifyRideCheck} />
                        {rideCheckOutcome ? <Text style={rideCheckOutcome.verified ? styles.status : styles.error}>{rideCheckOutcomeText(rideCheckOutcome)}</Text> : null}
                      </>
                    ) : null}
                    {journey.journeyStatus === 'PASSENGER_VERIFIED' ? <PrimaryButton busy={busy} label="Start protected journey" onPress={startProtectedJourney} /> : null}
                    {['IN_PROGRESS', 'ARRIVING'].includes(journey.journeyStatus) ? (
                      <View style={styles.activeJourney} accessibilityRole="summary">
                        <Text style={styles.noticeTitle}>Active Journey · {journey.journeyHealth}</Text>
                        <Text style={styles.body}>Telemetry: {journey.latestDriverLocation?.telemetryState ?? 'UNKNOWN'} · pending route changes: {journey.pendingRouteChangeCount}</Text>
                        <Text style={styles.body}>Completion context: {journey.completionRequirements.serviceContext} · handover {journey.completionRequirements.handoverRequired ? 'required' : 'not required'}</Text>
                        {journey.continuityCaseOpen ? <Text style={styles.error}>A continuity case is open. Completion remains blocked.</Text> : null}
                        {journey.completionRequirements.handoverRequired && !journey.completionRequirements.authorisedHandoverRecorded ? <Text style={styles.error}>Completion stays blocked until an authorised handover is recorded. Passenger details alone are not authority.</Text> : null}
                        {journey.completionRequirements.handoverFailureOpen ? <Text style={styles.error}>Failed handover is open. Do not complete the Journey.</Text> : null}
                        <SafetyButton busy={busy} label="SOS — get help" onPress={sendSos} />
                        <Field label="Unsafe rider conduct — describe in your own words" value={riderConductDetails} onChangeText={setRiderConductDetails} />
                        <SecondaryButton label="Report rider conduct without ending Journey" onPress={() => reportRiderConduct(false)} />
                        <SafetyButton busy={busy} label="End unsafe Journey safely" onPress={() => reportRiderConduct(true)} />
                        {riderConductCase ? <Text style={styles.status}>Safety case {riderConductCase.riderConductCaseId} persisted · rating protection required · no Driver misconduct finding</Text> : null}
                        {safetyStatus ? <Text style={styles.status}>{safetyStatus}</Text> : null}
                        {journey.journeyStatus === 'IN_PROGRESS' ? <PrimaryButton busy={busy} label="Mark destination approach with evidence" onPress={markDestinationApproach} /> : null}
                        {journey.journeyStatus === 'ARRIVING' ? <PrimaryButton busy={busy} label="Complete after requirements pass" onPress={finishJourney} /> : null}
                      </View>
                    ) : null}
                    {journey.journeyStatus === 'COMPLETED' ? (
                      <View style={styles.section}>
                        <Text style={styles.status}>Journey completed. Driver availability returned to AVAILABLE; no earning is inferred from the Rider fare.</Text>
                        <SecondaryButton label="Refresh authoritative earnings" onPress={refreshEarnings} />
                        {earnings ? <Text style={styles.body}>{earnings.earnings.length
                          ? `${earnings.earnings.length} separately posted Driver earning record(s).`
                          : 'No DriverEarning has been posted. A completed Journey is not itself an earning or payout.'}</Text> : null}
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {sessionToken ? (
          <View style={styles.notice} accessibilityRole="summary">
            <Text style={styles.noticeTitle}>Communication inbox — intent is not delivery</Text>
            <Text style={styles.body}>Driver operations, Safety, Support, payment and marketing stay purpose-separated. Silent Assistance never falls back to an automatic call, stale messages are suppressed and UNKNOWN never means delivered.</Text>
            <SecondaryButton label="Refresh governed communications" onPress={refreshCommunications} />
            <Text style={styles.devNotice}>EXTERNAL PUSH · SMS · EMAIL · TELEPHONY · CHAT PROVIDERS DISABLED</Text>
            {communicationInbox ? <Text style={styles.body}>Messages: {communicationInbox.communications.length} · provider execution: NO · channel health is explicit, never assumed.</Text> : null}
            {communicationInbox?.communications.map((communication) => (
              <Text key={communication.communicationId} style={communication.acknowledgementRequired ? styles.status : styles.body}>
                {communication.priority} {communication.purpose}: {communication.status} · acknowledgement {communication.acknowledgementRequired ? 'required' : 'not required'}
              </Text>
            ))}
          </View>
        ) : null}

        {sessionToken ? (
          <View style={styles.notice} accessibilityRole="summary">
            <Text style={styles.noticeTitle}>Telephone and voice never bypass Driver authority</Text>
            <Text style={styles.body}>Caller ID never proves identity. Voice and operators use the same Driver, Journey, Safety, payment and Support commands; active-Journey context can follow a warm handoff, but no caller can bypass scoped authority.</Text>
            <Text style={styles.body}>Low confidence, Safety, safeguarding, distress and high-risk security/payment changes require a person. General voice never captures full card details, and a dropped call cannot duplicate a Booking or payment.</Text>
            <SecondaryButton label="Refresh telephone and Contact Plan truth" onPress={refreshTelephoneAccessTruth} />
            <Text style={styles.devNotice}>TELEPHONY · VOICE ASSISTANT · RECORDING · TRANSCRIPTION PROVIDERS DISABLED</Text>
            {telephonyCapabilities ? <Text style={styles.body}>Canonical engines: YES · caller ID authenticates: NO · Voice Assistant configured: NO</Text> : null}
            {contactPlan ? <Text style={styles.body}>Contact Plan: {contactPlan.status} · diagnosis stored: NO · personal contacts exposed: NO</Text> : null}
            {telephonyInteractions ? <Text style={styles.body}>Authoritative telephone interactions: {telephonyInteractions.interactions.length}</Text> : null}
          </View>
        ) : null}

        {sessionToken ? (
          <View style={styles.notice} accessibilityRole="summary">
            <Text style={styles.noticeTitle}>Omnichannel casework preserves Driver and service truth</Text>
            <Text style={styles.body}>Versioned policy governs which Driver, Fleet, compliance, payout and Support facts may be communicated. Communications never calculates earnings, invents restrictions or turns contactability into a long-term Driver rating.</Text>
            <Text style={styles.body}>Critical delivery failure becomes an owned Contact Centre case. Channel switching preserves identity, permission and interaction history; recovery revalidates canonical state before queued messages can proceed.</Text>
            <SecondaryButton label="Refresh communications operations truth" onPress={refreshCommunicationsOperationsTruth} />
            <Text style={styles.devNotice}>PROVIDERS · CONTACT CENTRE MUTATIONS · REAL-USER SCENARIOS DISABLED</Text>
            {communicationsOperationsCapabilities ? <Text style={styles.body}>Versioned policies: YES · provider execution: NO · staff mutation: NO</Text> : null}
            {contactCases ? <Text style={styles.body}>Driver-owned Contact Centre cases: {contactCases.cases.length}</Text> : null}
            {communicationsOperationsStatus ? <Text style={styles.body}>Critical failures: {communicationsOperationsStatus.openCriticalFailureCaseCount} · pending acknowledgements: {communicationsOperationsStatus.pendingCriticalAcknowledgementCount}</Text> : null}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.label}>{props.label}</Text><TextInput value={props.value} onChangeText={props.onChangeText} style={styles.input} accessibilityLabel={props.label} /></View>;
}

function PrimaryButton(props: { busy: boolean; label: string; onPress: () => void }) {
  return <Pressable disabled={props.busy} onPress={props.onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, props.busy && styles.disabled]}>{props.busy ? <ActivityIndicator /> : <Text style={styles.primaryText}>{props.label}</Text>}</Pressable>;
}

function SecondaryButton(props: { label: string; onPress: () => void }) {
  return <Pressable onPress={props.onPress} style={styles.secondaryButton}><Text style={styles.secondaryText}>{props.label}</Text></Pressable>;
}

function SafetyButton(props: { busy: boolean; label: string; onPress: () => void }) {
  return <Pressable disabled={props.busy} onPress={props.onPress} accessibilityRole="button" style={styles.safetyButton}><Text style={styles.safetyText}>{props.label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dazatTokens.color.canvas },
  container: { padding: dazatTokens.spacing[6], gap: dazatTokens.spacing[4] },
  eyebrow: { fontSize: 12, fontWeight: '600', color: dazatTokens.color.textMuted, marginTop: dazatTokens.spacing[4] },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: dazatTokens.color.textPrimary },
  body: { fontSize: 16, lineHeight: 24, color: dazatTokens.color.textMuted },
  section: { gap: dazatTokens.spacing[3] },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: dazatTokens.color.textPrimary },
  field: { gap: dazatTokens.spacing[2] },
  label: { fontSize: 14, fontWeight: '600', color: dazatTokens.color.textPrimary },
  input: { minHeight: 52, borderWidth: 1, borderColor: dazatTokens.color.border, borderRadius: dazatTokens.radius.input, paddingHorizontal: dazatTokens.spacing[4], fontSize: 16, color: dazatTokens.color.textPrimary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: dazatTokens.spacing[2] },
  primaryButton: { minHeight: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: dazatTokens.color.textPrimary, borderRadius: dazatTokens.radius.button, paddingHorizontal: dazatTokens.spacing[4] },
  primaryText: { color: dazatTokens.color.canvas, fontSize: 16, fontWeight: '700' },
  secondaryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: dazatTokens.spacing[4], borderWidth: 1, borderColor: dazatTokens.color.border, borderRadius: dazatTokens.radius.button },
  secondaryText: { color: dazatTokens.color.textPrimary, fontSize: 14, fontWeight: '700' },
  selected: { borderColor: dazatTokens.color.textPrimary, backgroundColor: dazatTokens.color.surface },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  error: { color: dazatTokens.color.danger, fontSize: 14, lineHeight: 20 },
  notice: { padding: dazatTokens.spacing[5], backgroundColor: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card, gap: dazatTokens.spacing[2] },
  activeJourney: { padding: dazatTokens.spacing[4], borderWidth: 2, borderColor: dazatTokens.color.textPrimary, borderRadius: dazatTokens.radius.card, gap: dazatTokens.spacing[3] },
  safetyButton: { minHeight: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: dazatTokens.spacing[4], backgroundColor: dazatTokens.color.danger, borderRadius: dazatTokens.radius.button },
  safetyText: { color: dazatTokens.color.canvas, fontSize: 18, fontWeight: '700' },
  noticeTitle: { fontSize: 18, fontWeight: '700', color: dazatTokens.color.textPrimary },
  status: { fontSize: 16, fontWeight: '700', color: dazatTokens.color.textPrimary },
  devNotice: { fontSize: 13, lineHeight: 18, color: dazatTokens.color.textMuted, fontWeight: '600' }
});

import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dazatTokens } from '@dazat/design-system';
import type { ActiveJourneyProjection, DriverApplicationProjection, DriverEarningsProjection, DriverEligibilitySummary, DriverOfferSummary, DriverOperatingEligibilityProjection, FleetAgreementProjection, FleetMarketplaceOfferProjection, RegistrationContactType, VehicleAssignmentValidationProjection, VerifyRideCheckResult } from '@dazat/contracts';
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
    });
  }

  function goOffline() {
    void run(async () => {
      const result = await setDriverAvailability(sessionToken, { status: 'OFFLINE' });
      setAvailability(result.status);
      setEligibility(result.eligibility);
      setOffers([]);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>ENGINEERING PHASE 0.9</Text>
        <Text style={styles.title}>DAZAT Driver journey</Text>
        <Text style={styles.body}>Authentication does not make a driver eligible; all hard checks must pass before Dispatch. Pickup evidence and RideCheck protect the start. During an active Journey, telemetry confidence, Safety state, destination evidence and completion requirements remain separate backend-owned truths.</Text>

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
                <Text style={styles.body}>Expires {offer.expiresAt}. Declining or letting this expire is not an ordinary acceptance-rate punishment.</Text>
                <View style={styles.row}>
                  <PrimaryButton busy={busy} label="Accept this offer" onPress={() => accept(offer.offerId)} />
                  <SecondaryButton label="Decline without penalty" onPress={() => decline(offer.offerId)} />
                </View>
              </View>
            ))}
            {assignment ? (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>Atomic assignment confirmed</Text>
                <Text style={styles.body}>{assignment}</Text>
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

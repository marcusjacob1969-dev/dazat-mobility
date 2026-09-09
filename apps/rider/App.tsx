import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { dazatTokens } from '@dazat/design-system';
import type { ActiveJourneyProjection, BookingDispatchProjection, BookingQuoteResult, BookingSummary, CommunicationInboxProjection, CommunicationsClosureCapabilitiesProjection, CommunicationsClosureStatusProjection, CommunicationsLaunchReadinessProjection, CommunicationsOperationsCapabilitiesProjection, CommunicationsOperationsStatusProjection, ContactCaseListProjection, ContactPlanProjection, CoreJourneyProgressProjection, PaymentStatusProjection, RegistrationContactType, StartRideCheckResult, TelephonyInteractionListProjection, TelephonyServiceCapabilitiesProjection } from '@dazat/contracts';
import {
  confirmRiderContactVerification,
  startRiderContactVerification,
  startRiderRegistration
} from './src/identity-api';
import { confirmRiderBooking, createRiderBooking, quoteRiderBooking } from './src/booking-api';
import { getBookingDispatch, startBookingDispatch } from './src/dispatch-api';
import { getBookingJourney, requestJourneyStop, sendRiderSafetySignal, startPassengerRideCheck } from './src/journey-api';
import { prepareProviderDisabledPaymentIntent, readPaymentStatus } from './src/finance-api';
import { readCommunicationInbox } from './src/communications-api';
import { readContactPlan, readTelephonyCapabilities, readTelephonyInteractions } from './src/telephony-voice-api';
import { readCommunicationsClosureCapabilities, readCommunicationsClosureStatus, readCommunicationsLaunchReadiness, readCommunicationsOperationsCapabilities, readCommunicationsOperationsStatus, readContactCases } from './src/communications-operations-api';
import { readCoreJourneyProgress } from './src/core-journey-api';

type Flow = 'REGISTER' | 'VERIFY' | 'BOOK' | 'QUOTE' | 'READY';

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad'; placeholder?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        style={styles.input}
        keyboardType={props.keyboardType ?? 'default'}
        placeholder={props.placeholder}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function RiderApp() {
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

  const [regionCode, setRegionCode] = useState('MANCHESTER');
  const [pickupLabel, setPickupLabel] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLon, setPickupLon] = useState('');
  const [dropoffLabel, setDropoffLabel] = useState('');
  const [dropoffLat, setDropoffLat] = useState('');
  const [dropoffLon, setDropoffLon] = useState('');
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [quote, setQuote] = useState<BookingQuoteResult['quote'] | null>(null);
  const [dispatch, setDispatch] = useState<BookingDispatchProjection | null>(null);
  const [journey, setJourney] = useState<ActiveJourneyProjection | null>(null);
  const [rideCheck, setRideCheck] = useState<StartRideCheckResult | null>(null);
  const [changeLabel, setChangeLabel] = useState('');
  const [changeLat, setChangeLat] = useState('');
  const [changeLon, setChangeLon] = useState('');
  const [journeyNotice, setJourneyNotice] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusProjection | null>(null);
  const [coreJourneyProgress, setCoreJourneyProgress] = useState<CoreJourneyProgressProjection | null>(null);
  const [communicationInbox, setCommunicationInbox] = useState<CommunicationInboxProjection | null>(null);
  const [telephonyCapabilities, setTelephonyCapabilities] = useState<TelephonyServiceCapabilitiesProjection | null>(null);
  const [contactPlan, setContactPlan] = useState<ContactPlanProjection | null>(null);
  const [telephonyInteractions, setTelephonyInteractions] = useState<TelephonyInteractionListProjection | null>(null);
  const [communicationsOperationsCapabilities, setCommunicationsOperationsCapabilities] = useState<CommunicationsOperationsCapabilitiesProjection | null>(null);
  const [contactCases, setContactCases] = useState<ContactCaseListProjection | null>(null);
  const [communicationsOperationsStatus, setCommunicationsOperationsStatus] = useState<CommunicationsOperationsStatusProjection | null>(null);
  const [communicationsClosureCapabilities, setCommunicationsClosureCapabilities] = useState<CommunicationsClosureCapabilitiesProjection | null>(null);
  const [communicationsClosureStatus, setCommunicationsClosureStatus] = useState<CommunicationsClosureStatusProjection | null>(null);
  const [communicationsLaunchReadiness, setCommunicationsLaunchReadiness] = useState<CommunicationsLaunchReadinessProjection | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  function refreshJourney() {
    if (!booking) return;
    void run(async () => setJourney(await getBookingJourney(sessionToken, booking.bookingId)));
  }

  function createRideCheck() {
    if (!journey) return;
    void run(async () => {
      const result = await startPassengerRideCheck(sessionToken, journey.journeyId);
      setRideCheck(result);
      setJourney(await getBookingJourney(sessionToken, journey.bookingId));
    });
  }

  function createAccount() {
    void run(async () => {
      const result = await startRiderRegistration({
        profileKind: 'RIDER',
        preferredName,
        contact: { type: contactType, value: contact }
      });
      setAccountId(result.accountId);
      setContactPointId(result.contact.id);
      setDisplayHint(result.contact.displayHint);
      setFlow('VERIFY');
    });
  }

  function sendVerificationCode() {
    void run(async () => {
      const result = await startRiderContactVerification(accountId, contactPointId);
      setVerificationId(result.verificationId);
      setDevelopmentCode(result.developmentCode ?? '');
      setFlow('VERIFY');
    });
  }

  function verifyContact() {
    void run(async () => {
      const result = await confirmRiderContactVerification({ verificationId, code: verificationCode });
      setSessionToken(result.session.bearerToken);
      setFlow('BOOK');
    });
  }

  function createBookingDraft() {
    void run(async () => {
      const result = await createRiderBooking(sessionToken, {
        regionCode,
        pickup: { latitude: Number(pickupLat), longitude: Number(pickupLon), displayLabel: pickupLabel },
        dropoff: { latitude: Number(dropoffLat), longitude: Number(dropoffLon), displayLabel: dropoffLabel }
      });
      setBooking(result);
      setFlow('QUOTE');
    });
  }

  function requestQuote() {
    if (!booking) return;
    void run(async () => {
      const result = await quoteRiderBooking(sessionToken, booking.bookingId);
      setBooking(result.booking);
      setQuote(result.quote);
    });
  }

  function confirmQuote() {
    if (!booking || !quote) return;
    void run(async () => {
      const result = await confirmRiderBooking(sessionToken, booking.bookingId, quote.quoteId);
      setBooking(result.booking);
      setFlow('READY');
    });
  }

  function beginDispatch() {
    if (!booking) return;
    void run(async () => {
      const result = await startBookingDispatch(sessionToken, booking.bookingId);
      setBooking({ ...booking, status: result.bookingStatus });
      setDispatch(await getBookingDispatch(sessionToken, booking.bookingId));
    });
  }

  function refreshDispatch() {
    if (!booking) return;
    void run(async () => {
      const result = await getBookingDispatch(sessionToken, booking.bookingId);
      setDispatch(result);
      setBooking({ ...booking, status: result.bookingStatus });
    });
  }

  function requestStop() {
    if (!journey) return;
    void run(async () => {
      const result = await requestJourneyStop(sessionToken, journey, {
        latitude: Number(changeLat), longitude: Number(changeLon), displayLabel: changeLabel
      });
      setJourneyNotice(result.message);
      setJourney(await getBookingJourney(sessionToken, journey.bookingId));
    });
  }

  function signalSafety(signal: 'SOS' | 'SILENT_ASSISTANCE' | 'ROUTE_CONCERN', category?: 'CHECK_ROUTE' | 'FEEL_UNSAFE') {
    if (!journey) return;
    void run(async () => {
      const result = await sendRiderSafetySignal(sessionToken, journey.journeyId, signal, category);
      setJourneyNotice(signal === 'SILENT_ASSISTANCE'
        ? `Silent Assistance persisted · ${result.journeyHealth} · no automatic call to you`
        : `${signal.replace('_', ' ')} persisted · ${result.journeyHealth}`);
      setJourney(await getBookingJourney(sessionToken, journey.bookingId));
    });
  }

  function preparePaymentIntent() {
    if (!booking) return;
    void run(async () => {
      const intent = await prepareProviderDisabledPaymentIntent(sessionToken, booking.bookingId);
      setPaymentStatus(await readPaymentStatus(sessionToken, intent.paymentIntentId));
    });
  }

  function refreshPaymentStatus() {
    if (!paymentStatus) return;
    void run(async () => setPaymentStatus(await readPaymentStatus(sessionToken, paymentStatus.paymentIntentId)));
  }

  function refreshCoreJourneyProgress() {
    if (!booking) return;
    void run(async () => setCoreJourneyProgress(await readCoreJourneyProgress(sessionToken, booking.bookingId)));
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

  function refreshCommunicationsClosureTruth() {
    void run(async () => {
      const [capabilities, status, readiness] = await Promise.all([
        readCommunicationsClosureCapabilities(), readCommunicationsClosureStatus(sessionToken),
        readCommunicationsLaunchReadiness(sessionToken)
      ]);
      setCommunicationsClosureCapabilities(capabilities);
      setCommunicationsClosureStatus(status);
      setCommunicationsLaunchReadiness(readiness);
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>ENGINEERING PHASE 0.51</Text>
        <Text style={styles.title}>DAZAT Rider journey</Text>
        <Text style={styles.body}>Verified Booking through protected pickup, active Journey visibility, governed changes and persistent Safety controls.</Text>

        {flow === 'REGISTER' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Create account</Text>
            <Field label="Preferred name" value={preferredName} onChangeText={setPreferredName} />
            <View style={styles.contactSwitch}>
              {(['EMAIL', 'MOBILE'] as const).map((type) => (
                <Pressable key={type} onPress={() => { setContactType(type); setContact(''); }} style={[styles.switchButton, contactType === type && styles.switchButtonSelected]}>
                  <Text style={styles.switchText}>{type === 'EMAIL' ? 'Email' : 'Mobile'}</Text>
                </Pressable>
              ))}
            </View>
            <Field label={contactType === 'EMAIL' ? 'Email address' : 'Mobile number (+country code)'} value={contact} onChangeText={setContact} keyboardType={contactType === 'EMAIL' ? 'email-address' : 'phone-pad'} />
            <PrimaryButton label="Create Rider account" busy={busy} onPress={createAccount} />
          </View>
        )}

        {flow === 'VERIFY' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Verify {displayHint}</Text>
            {!verificationId ? (
              <PrimaryButton label="Send verification code" busy={busy} onPress={sendVerificationCode} />
            ) : (
              <>
                {developmentCode ? <Text style={styles.devNotice}>Development-only code: {developmentCode}</Text> : null}
                <Field label="Six-digit verification code" value={verificationCode} onChangeText={setVerificationCode} keyboardType="numeric" />
                <PrimaryButton label="Verify and create session" busy={busy} onPress={verifyContact} />
              </>
            )}
          </View>
        )}

        {flow === 'BOOK' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Create Booking</Text>
            <Text style={styles.body}>Phase 0.3 uses manual coordinates to exercise the authoritative backend before map-provider integration.</Text>
            <Field label="Region code" value={regionCode} onChangeText={setRegionCode} />
            <Field label="Pickup label" value={pickupLabel} onChangeText={setPickupLabel} />
            <Field label="Pickup latitude" value={pickupLat} onChangeText={setPickupLat} keyboardType="numeric" />
            <Field label="Pickup longitude" value={pickupLon} onChangeText={setPickupLon} keyboardType="numeric" />
            <Field label="Drop-off label" value={dropoffLabel} onChangeText={setDropoffLabel} />
            <Field label="Drop-off latitude" value={dropoffLat} onChangeText={setDropoffLat} keyboardType="numeric" />
            <Field label="Drop-off longitude" value={dropoffLon} onChangeText={setDropoffLon} keyboardType="numeric" />
            <PrimaryButton label="Create DRAFT Booking" busy={busy} onPress={createBookingDraft} />
          </View>
        )}

        {flow === 'QUOTE' && booking && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Quote and confirm</Text>
            <Text style={styles.body}>Booking {booking.bookingId}</Text>
            <Text style={styles.status}>Authoritative state: {booking.status}</Text>
            {!quote ? (
              <PrimaryButton label="Create development quote" busy={busy} onPress={requestQuote} />
            ) : (
              <>
                <View style={styles.notice}>
                  <Text style={styles.noticeTitle}>{quote.currency} {quote.amountMinor} minor units</Text>
                  <Text style={styles.body}>{quote.policyVersion}</Text>
                  <Text style={styles.devNotice}>NON-COMMERCIAL DEVELOPMENT FIXTURE</Text>
                </View>
                <PrimaryButton label="Confirm quoted Booking" busy={busy} onPress={confirmQuote} />
              </>
            )}
          </View>
        )}

        {flow === 'READY' && booking && (
          <View style={styles.notice} accessibilityRole="summary">
            <Text style={styles.noticeTitle}>Booking ready for Dispatch</Text>
            <Text style={styles.status}>{booking.status}</Text>
            <SecondaryButton label="Refresh complete journey progress" onPress={refreshCoreJourneyProgress} />
            {coreJourneyProgress ? (
              <View style={styles.section} accessibilityRole="summary">
                <Text style={styles.status}>Next: {coreJourneyProgress.nextAction.replaceAll('_', ' ')}</Text>
                {coreJourneyProgress.milestones.map((item) => (
                  <Text key={item.name} style={item.status === 'BLOCKED' ? styles.error : styles.body}>
                    {item.name.replaceAll('_', ' ')} · {item.status.replaceAll('_', ' ')}
                  </Text>
                ))}
                <Text style={styles.devNotice}>PRODUCTION CHARGING DISABLED</Text>
              </View>
            ) : null}
            <Text style={styles.body}>No driver has been invented or assigned at booking confirmation. Dispatch now applies compliance, vehicle, availability, location and hard-service filters before offering the work. It never invents a driver or ETA.</Text>
            {!dispatch ? <PrimaryButton label="Start eligible-driver search" busy={busy} onPress={beginDispatch} /> : <PrimaryButton label="Refresh Dispatch status" busy={busy} onPress={refreshDispatch} />}
            {dispatch ? (
              <View style={styles.section}>
                <Text style={styles.status}>Dispatch: {dispatch.dispatchStatus ?? 'NOT_STARTED'}</Text>
                <Text style={styles.body}>{dispatch.driverAssigned ? 'An eligible Driver accepted and was assigned atomically.' : 'No Driver assignment exists yet.'}</Text>
                {dispatch.driverAssigned ? <PrimaryButton label="Refresh pickup journey" busy={busy} onPress={refreshJourney} /> : null}
                {journey ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeTitle}>Journey: {journey.journeyStatus}</Text>
                    <Text style={styles.body}>Driver location: {journey.latestDriverLocation?.telemetryState ?? 'UNKNOWN'}. Stale or unknown location is never presented as live certainty.</Text>
                    {journey.journeyStatus === 'ARRIVED' ? <PrimaryButton label="Create protected RideCheck" busy={busy} onPress={createRideCheck} /> : null}
                    {rideCheck?.challengeCode ? (
                      <View style={styles.section} accessibilityRole="summary">
                        <Text style={styles.status}>RideCheck PIN: {rideCheck.challengeCode}</Text>
                        <Text style={styles.body}>Show the PIN only to the assigned Driver at pickup. It is returned once and is not stored as plaintext.</Text>
                      </View>
                    ) : null}
                    {journey.activeOperationalHold ? <Text style={styles.error}>Protected start hold active. Normal support cannot bypass this boundary.</Text> : null}
                    {['IN_PROGRESS', 'ARRIVING'].includes(journey.journeyStatus) ? (
                      <View style={styles.activeJourney}>
                        <Text style={styles.status}>Journey health: {journey.journeyHealth}</Text>
                        <Text style={styles.body}>Reconnect source: {journey.reconnectInstruction}. Pending route changes: {journey.pendingRouteChangeCount}.</Text>
                        {journey.continuityCaseOpen ? <Text style={styles.error}>A continuity case is open; completion remains blocked while support coordinates the Journey.</Text> : null}
                        <View style={styles.actionRow}>
                          <SafetyButton label="SOS" busy={busy} onPress={() => signalSafety('SOS')} />
                          <SecondaryButton label="Silent Assistance" onPress={() => signalSafety('SILENT_ASSISTANCE')} />
                          <SecondaryButton label="Check route" onPress={() => signalSafety('ROUTE_CONCERN', 'CHECK_ROUTE')} />
                          <SecondaryButton label="I feel unsafe" onPress={() => signalSafety('ROUTE_CONCERN', 'FEEL_UNSAFE')} />
                        </View>
                        <Text style={styles.body}>A route concern is contextual evidence, never an automatic misconduct finding.</Text>
                        <Field label="Requested stop label" value={changeLabel} onChangeText={setChangeLabel} />
                        <Field label="Requested stop latitude" value={changeLat} onChangeText={setChangeLat} keyboardType="numeric" />
                        <Field label="Requested stop longitude" value={changeLon} onChangeText={setChangeLon} keyboardType="numeric" />
                        <SecondaryButton label="Request stop for policy review" onPress={requestStop} />
                        <Text style={styles.body}>The route does not change until pricing, authority, communication and Driver acknowledgement rules succeed.</Text>
                        {journey.completionRequirements.handoverRequired ? <Text style={styles.body}>This Journey requires an authorised handover before completion.</Text> : null}
                        {journeyNotice ? <Text style={styles.status}>{journeyNotice}</Text> : null}
                      </View>
                    ) : null}
                    {journey.journeyStatus === 'COMPLETED' ? (
                      <View style={styles.section}>
                        <Text style={styles.status}>Journey completed. Completion itself did not initiate payment.</Text>
                        {!paymentStatus
                          ? <PrimaryButton label="Prepare payment intent — charging disabled" busy={busy} onPress={preparePaymentIntent} />
                          : <SecondaryButton label="Refresh payment status" onPress={refreshPaymentStatus} />}
                        {paymentStatus ? (
                          <View style={styles.notice} accessibilityRole="summary">
                            <Text style={styles.noticeTitle}>Payment intent: {paymentStatus.status}</Text>
                            <Text style={styles.body}>{paymentStatus.currency} {paymentStatus.amountMinor} minor units</Text>
                            <Text style={styles.body}>Charging eligibility: {paymentStatus.chargingEligibility}</Text>
                            <Text style={styles.devNotice}>NO CHARGE ATTEMPTED · PRODUCTION CHARGING DISABLED</Text>
                            <Text style={styles.body}>{paymentStatus.guidance}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )}

        {sessionToken ? (
          <View style={styles.notice} accessibilityRole="summary">
            <Text style={styles.noticeTitle}>Communication inbox — intent is not delivery</Text>
            <Text style={styles.body}>Safety, Journey, payment, account and marketing purposes stay separate. Marketing cannot bypass consent, stale source versions are suppressed, and UNKNOWN never means delivered.</Text>
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
            <Text style={styles.noticeTitle}>Communications closure preserves authority before delivery</Text>
            <Text style={styles.body}>Every request carries an immutable source event, recipient role, approved payload variables, current source version and versioned fallback policy. Priority never grants access to another party&apos;s financial, Safety or support data.</Text>
            <Text style={styles.body}>The complete acceptance and launch-gate catalogues are modelled. A green source test is not a provider approval, staffed operation, privacy sign-off or launch decision.</Text>
            <SecondaryButton label="Refresh communications closure truth" onPress={refreshCommunicationsClosureTruth} />
            <Text style={styles.devNotice}>PROVIDER BYPASS · CLOSURE COMMANDS · PILOT LAUNCH DISABLED</Text>
            {communicationsClosureCapabilities ? <Text style={styles.body}>Canonical request/envelope: YES · critical events: {communicationsClosureCapabilities.criticalEventTypes.length} · P0 requirements: {communicationsClosureCapabilities.p0Requirements.length} · acceptance cases: {communicationsClosureCapabilities.acceptanceScenarios.length} · launch gates: {communicationsClosureCapabilities.launchGates.length}</Text> : null}
            {communicationsClosureStatus ? <Text style={styles.body}>Recipient requests: {communicationsClosureStatus.communicationRequestCount} · stale suppressed: {communicationsClosureStatus.suppressedStaleRequestCount} · priority expands access: NO</Text> : null}
            {communicationsLaunchReadiness ? <Text style={styles.body}>Launch evidence complete: {communicationsLaunchReadiness.evidenceComplete ? 'YES' : 'NO'} · pilot ready: NO · provider execution: NO</Text> : null}
          </View>
        ) : null}

        {sessionToken ? (
          <View style={styles.notice} accessibilityRole="summary">
            <Text style={styles.noticeTitle}>Telephone access uses the same canonical service</Text>
            <Text style={styles.body}>Caller ID never proves identity. Voice recognition cannot invent pickup, destination, passenger, time, accessibility or fare terms; critical fields require readback and confirmation before the canonical Booking command.</Text>
            <Text style={styles.body}>Low confidence, Safety, safeguarding, caller distress and high-risk security changes require warm human handoff. Operators and general voice never receive full card details, and STATUS_UNKNOWN never triggers repeat collection.</Text>
            <SecondaryButton label="Refresh telephone and Contact Plan truth" onPress={refreshTelephoneAccessTruth} />
            <Text style={styles.devNotice}>TELEPHONY · VOICE ASSISTANT · RECORDING · TRANSCRIPTION PROVIDERS DISABLED</Text>
            {telephonyCapabilities ? <Text style={styles.body}>Canonical engines: YES · caller ID authenticates: NO · Voice Assistant configured: NO</Text> : null}
            {contactPlan ? <Text style={styles.body}>Contact Plan: {contactPlan.status} · diagnosis stored: NO · personal contacts exposed: NO</Text> : null}
            {telephonyInteractions ? <Text style={styles.body}>Authoritative telephone interactions: {telephonyInteractions.interactions.length}</Text> : null}
          </View>
        ) : null}

        {sessionToken ? (
          <View style={styles.notice} accessibilityRole="summary">
            <Text style={styles.noticeTitle}>Critical communication failure becomes owned operational work</Text>
            <Text style={styles.body}>Every event-to-role/channel decision comes from a versioned policy and current canonical state. Sent is not delivered, delivered is not read, and read is not acknowledged.</Text>
            <Text style={styles.body}>A Contact Centre case preserves the channel timeline but never replaces Booking, Journey, Safety, Finance or Fleet truth. Provider recovery revalidates queued work so stale updates are not replayed.</Text>
            <SecondaryButton label="Refresh communications operations truth" onPress={refreshCommunicationsOperationsTruth} />
            <Text style={styles.devNotice}>PROVIDERS · CONTACT CENTRE MUTATIONS · REAL-USER SCENARIOS DISABLED</Text>
            {communicationsOperationsCapabilities ? <Text style={styles.body}>Versioned policies: YES · provider execution: NO · staff mutation: NO</Text> : null}
            {contactCases ? <Text style={styles.body}>Recipient-owned Contact Centre cases: {contactCases.cases.length}</Text> : null}
            {communicationsOperationsStatus ? <Text style={styles.body}>Critical failures: {communicationsOperationsStatus.openCriticalFailureCaseCount} · pending acknowledgements: {communicationsOperationsStatus.pendingCriticalAcknowledgementCount}</Text> : null}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton(props: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, props.busy && styles.disabled]}>
      {props.busy ? <ActivityIndicator /> : <Text style={styles.primaryButtonText}>{props.label}</Text>}
    </Pressable>
  );
}

function SecondaryButton(props: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{props.label}</Text></Pressable>;
}

function SafetyButton(props: { label: string; busy: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onPress} style={styles.safetyButton}><Text style={styles.safetyButtonText}>{props.label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dazatTokens.color.canvas },
  container: { padding: dazatTokens.spacing[6], gap: dazatTokens.spacing[4] },
  eyebrow: { fontSize: 12, fontWeight: '600', color: dazatTokens.color.textMuted, marginTop: dazatTokens.spacing[4] },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: dazatTokens.color.textPrimary },
  body: { fontSize: 16, lineHeight: 24, color: dazatTokens.color.textMuted },
  section: { gap: dazatTokens.spacing[3], paddingVertical: dazatTokens.spacing[3] },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: dazatTokens.color.textPrimary },
  field: { gap: dazatTokens.spacing[2] },
  label: { fontSize: 14, fontWeight: '600', color: dazatTokens.color.textPrimary },
  input: { minHeight: 52, borderWidth: 1, borderColor: dazatTokens.color.border, borderRadius: dazatTokens.radius.input, paddingHorizontal: dazatTokens.spacing[4], fontSize: 16, color: dazatTokens.color.textPrimary },
  contactSwitch: { flexDirection: 'row', gap: dazatTokens.spacing[2] },
  switchButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: dazatTokens.spacing[4], borderWidth: 1, borderColor: dazatTokens.color.border, borderRadius: dazatTokens.radius.button },
  switchButtonSelected: { borderColor: dazatTokens.color.textPrimary, backgroundColor: dazatTokens.color.surface },
  switchText: { fontSize: 15, fontWeight: '600', color: dazatTokens.color.textPrimary },
  primaryButton: { marginTop: dazatTokens.spacing[2], minHeight: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: dazatTokens.color.textPrimary, borderRadius: dazatTokens.radius.button },
  primaryButtonText: { color: dazatTokens.color.canvas, fontSize: 16, fontWeight: '700' },
  secondaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: dazatTokens.color.border, borderRadius: dazatTokens.radius.button, paddingHorizontal: dazatTokens.spacing[4] },
  secondaryButtonText: { color: dazatTokens.color.textPrimary, fontSize: 15, fontWeight: '700' },
  safetyButton: { minHeight: 56, justifyContent: 'center', alignItems: 'center', backgroundColor: dazatTokens.color.danger, borderRadius: dazatTokens.radius.button, paddingHorizontal: dazatTokens.spacing[5] },
  safetyButtonText: { color: dazatTokens.color.canvas, fontSize: 18, fontWeight: '700' },
  actionRow: { gap: dazatTokens.spacing[2] },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  error: { color: dazatTokens.color.danger, fontSize: 14, lineHeight: 20 },
  notice: { padding: dazatTokens.spacing[5], backgroundColor: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card, gap: dazatTokens.spacing[2] },
  activeJourney: { marginTop: dazatTokens.spacing[3], padding: dazatTokens.spacing[4], borderWidth: 2, borderColor: dazatTokens.color.textPrimary, borderRadius: dazatTokens.radius.card, gap: dazatTokens.spacing[3] },
  noticeTitle: { fontSize: 20, fontWeight: '700', color: dazatTokens.color.textPrimary },
  status: { fontSize: 16, fontWeight: '700', color: dazatTokens.color.textPrimary },
  devNotice: { fontSize: 13, lineHeight: 18, color: dazatTokens.color.textMuted, fontWeight: '600' }
});

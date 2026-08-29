import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dazatTokens } from '@dazat/design-system';
import type { DriverEligibilitySummary, DriverOfferSummary, RegistrationContactType } from '@dazat/contracts';
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

type Flow = 'REGISTER' | 'VERIFY' | 'DRIVER_HOME';

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
    void run(async () => setEligibility(await getDriverEligibility(sessionToken, vehicleId || undefined)));
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
      setAvailability('ASSIGNED');
      setOffers([]);
    });
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
        <Text style={styles.eyebrow}>ENGINEERING PHASE 0.4</Text>
        <Text style={styles.title}>DAZAT Driver availability</Text>
        <Text style={styles.body}>Authentication, compliance, vehicle eligibility and online availability are separate truths. Authentication does not make a driver eligible; all hard checks must pass before Dispatch can offer or assign work.</Text>

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
            <Text style={styles.status}>Availability: {availability}</Text>
            <Field label="Authorised vehicle ID" value={vehicleId} onChangeText={setVehicleId} />
            <Field label="Region" value={regionCode} onChangeText={setRegionCode} />
            <Field label="Current latitude" value={latitude} onChangeText={setLatitude} />
            <Field label="Current longitude" value={longitude} onChangeText={setLongitude} />
            <View style={styles.row}>
              <SecondaryButton label="Check eligibility" onPress={checkEligibility} />
              {availability === 'OFFLINE' ? <SecondaryButton label="Go online" onPress={goOnline} /> : <SecondaryButton label="Go offline" onPress={goOffline} />}
            </View>
            {eligibility ? (
              <View style={styles.notice} accessibilityRole="summary">
                <Text style={styles.noticeTitle}>{eligibility.eligible ? 'Eligible for Dispatch' : 'Not eligible for Dispatch'}</Text>
                <Text style={styles.body}>{eligibility.blockers.length ? eligibility.blockers.join(', ') : 'All Phase 0.4 hard filters passed.'}</Text>
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
            {assignment ? <Text style={styles.status}>Atomic assignment confirmed: {assignment}</Text> : null}
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
  noticeTitle: { fontSize: 18, fontWeight: '700', color: dazatTokens.color.textPrimary },
  status: { fontSize: 16, fontWeight: '700', color: dazatTokens.color.textPrimary },
  devNotice: { fontSize: 13, lineHeight: 18, color: dazatTokens.color.textMuted, fontWeight: '600' }
});

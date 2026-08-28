import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dazatTokens } from '@dazat/design-system';
import type { RegistrationContactType } from '@dazat/contracts';
import {
  confirmDriverContactVerification,
  startDriverContactVerification,
  startDriverRegistration
} from './src/identity-api';

export default function DriverApp() {
  const [preferredName, setPreferredName] = useState('');
  const [contactType, setContactType] = useState<RegistrationContactType>('EMAIL');
  const [contact, setContact] = useState('');
  const [accountId, setAccountId] = useState('');
  const [contactPointId, setContactPointId] = useState('');
  const [displayHint, setDisplayHint] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [status, setStatus] = useState<'REGISTER' | 'VERIFY' | 'AUTHENTICATED' | 'BUSY' | 'ERROR'>('REGISTER');

  async function run(action: () => Promise<void>) {
    const previous = status;
    setStatus('BUSY');
    try { await action(); } catch { setStatus('ERROR'); }
    if (status === 'BUSY') setStatus(previous);
  }

  function startApplication() {
    void (async () => {
      setStatus('BUSY');
      try {
        const result = await startDriverRegistration({ profileKind: 'DRIVER', preferredName, contact: { type: contactType, value: contact } });
        setAccountId(result.accountId);
        setContactPointId(result.contact.id);
        setDisplayHint(result.contact.displayHint);
        setStatus('VERIFY');
      } catch { setStatus('ERROR'); }
    })();
  }

  function sendCode() {
    void (async () => {
      setStatus('BUSY');
      try {
        const result = await startDriverContactVerification(accountId, contactPointId);
        setVerificationId(result.verificationId);
        setDevelopmentCode(result.developmentCode ?? '');
        setStatus('VERIFY');
      } catch { setStatus('ERROR'); }
    })();
  }

  function verify() {
    void (async () => {
      setStatus('BUSY');
      try {
        await confirmDriverContactVerification({ verificationId, code: verificationCode });
        setStatus('AUTHENTICATED');
      } catch { setStatus('ERROR'); }
    })();
  }

  const busy = status === 'BUSY';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.eyebrow}>ENGINEERING PHASE 0.3</Text>
        <Text style={styles.title}>DAZAT Driver identity slice</Text>
        <Text style={styles.body}>Driver account authentication is real platform state. It does not make a driver eligible to work.</Text>

        {status === 'REGISTER' || status === 'ERROR' || status === 'BUSY' ? (
          <>
            <Text style={styles.label}>Preferred name</Text>
            <TextInput value={preferredName} onChangeText={setPreferredName} style={styles.input} />
            <View style={styles.contactSwitch}>
              {(['EMAIL', 'MOBILE'] as const).map((type) => (
                <Pressable key={type} onPress={() => { setContactType(type); setContact(''); }} style={[styles.switchButton, contactType === type && styles.switchButtonSelected]}>
                  <Text style={styles.switchText}>{type === 'EMAIL' ? 'Email' : 'Mobile'}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={contact} onChangeText={setContact} style={styles.input} placeholder={contactType === 'EMAIL' ? 'you@example.com' : '+44…'} />
            {status === 'ERROR' ? <Text style={styles.error}>The current step could not be completed.</Text> : null}
            <PrimaryButton busy={busy} label="Create Driver account" onPress={startApplication} />
          </>
        ) : null}

        {status === 'VERIFY' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Verify {displayHint}</Text>
            {!verificationId ? <PrimaryButton busy={false} label="Send verification code" onPress={sendCode} /> : (
              <>
                {developmentCode ? <Text style={styles.body}>Development-only code: {developmentCode}</Text> : null}
                <TextInput value={verificationCode} onChangeText={setVerificationCode} style={styles.input} keyboardType="numeric" placeholder="6 digits" />
                <PrimaryButton busy={false} label="Verify Driver account" onPress={verify} />
              </>
            )}
          </View>
        ) : null}

        {status === 'AUTHENTICATED' ? (
          <View style={styles.notice} accessibilityRole="summary">
            <Text style={styles.noticeTitle}>Driver account authenticated</Text>
            <Text style={styles.body}>Next Driver engineering phases add licensing, vehicle, insurance, training and service eligibility. Authentication alone never changes operating eligibility.</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function PrimaryButton(props: { busy: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={props.busy} onPress={props.onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, props.busy && styles.disabled]}>
      {props.busy ? <ActivityIndicator /> : <Text style={styles.primaryButtonText}>{props.label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dazatTokens.color.canvas },
  container: { flex: 1, padding: dazatTokens.spacing[6], gap: dazatTokens.spacing[3] },
  eyebrow: { fontSize: 12, fontWeight: '600', color: dazatTokens.color.textMuted, marginTop: dazatTokens.spacing[6] },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: dazatTokens.color.textPrimary },
  body: { fontSize: 16, lineHeight: 24, color: dazatTokens.color.textMuted },
  label: { marginTop: dazatTokens.spacing[2], fontSize: 14, fontWeight: '600', color: dazatTokens.color.textPrimary },
  input: { minHeight: 52, borderWidth: 1, borderColor: dazatTokens.color.border, borderRadius: dazatTokens.radius.input, paddingHorizontal: dazatTokens.spacing[4], fontSize: 16, color: dazatTokens.color.textPrimary },
  contactSwitch: { flexDirection: 'row', gap: dazatTokens.spacing[2] },
  switchButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: dazatTokens.spacing[4], borderWidth: 1, borderColor: dazatTokens.color.border, borderRadius: dazatTokens.radius.button },
  switchButtonSelected: { borderColor: dazatTokens.color.textPrimary, backgroundColor: dazatTokens.color.surface },
  switchText: { fontSize: 15, fontWeight: '600', color: dazatTokens.color.textPrimary },
  primaryButton: { marginTop: dazatTokens.spacing[3], minHeight: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: dazatTokens.color.textPrimary, borderRadius: dazatTokens.radius.button },
  primaryButtonText: { color: dazatTokens.color.canvas, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  error: { color: dazatTokens.color.danger, fontSize: 14, lineHeight: 20 },
  notice: { marginTop: dazatTokens.spacing[4], padding: dazatTokens.spacing[5], backgroundColor: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card, gap: dazatTokens.spacing[2] },
  noticeTitle: { fontSize: 20, fontWeight: '700', color: dazatTokens.color.textPrimary }
});

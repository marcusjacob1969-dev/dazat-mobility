import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dazatTokens } from '@dazat/design-system';
import type { RegistrationContactType } from '@dazat/contracts';
import { startDriverRegistration } from './src/identity-api';

export default function DriverApp() {
  const [preferredName, setPreferredName] = useState('');
  const [contactType, setContactType] = useState<RegistrationContactType>('EMAIL');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'SUBMITTING' | 'VERIFY_CONTACT' | 'ERROR'>('IDLE');
  const [displayHint, setDisplayHint] = useState('');

  async function startApplication() {
    setStatus('SUBMITTING');
    try {
      const result = await startDriverRegistration({
        profileKind: 'DRIVER',
        preferredName,
        contact: { type: contactType, value: contact }
      });
      setDisplayHint(result.contact.displayHint);
      setStatus('VERIFY_CONTACT');
    } catch {
      setStatus('ERROR');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.eyebrow}>ENGINEERING PHASE 0.2</Text>
        <Text style={styles.title}>Start your DAZAT Driver application</Text>
        <Text style={styles.body}>Creating a Driver profile does not make a driver eligible to work. Licensing, vehicle and compliance checks stay separate.</Text>

        {status === 'VERIFY_CONTACT' ? (
          <View style={styles.notice} accessibilityRole="summary">
            <Text style={styles.noticeTitle}>Application account started</Text>
            <Text style={styles.body}>Next: verify {displayHint}. Driver eligibility remains NOT STARTED until the later compliance phases.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Preferred name</Text>
            <TextInput accessibilityLabel="Preferred name" value={preferredName} onChangeText={setPreferredName} style={styles.input} autoCapitalize="words" autoComplete="name" />

            <View style={styles.contactSwitch}>
              {(['EMAIL', 'MOBILE'] as const).map((type) => (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityState={{ selected: contactType === type }}
                  onPress={() => { setContactType(type); setContact(''); }}
                  style={[styles.switchButton, contactType === type && styles.switchButtonSelected]}
                >
                  <Text style={styles.switchText}>{type === 'EMAIL' ? 'Email' : 'Mobile'}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{contactType === 'EMAIL' ? 'Email address' : 'Mobile number'}</Text>
            <TextInput
              accessibilityLabel={contactType === 'EMAIL' ? 'Email address' : 'Mobile number in international format'}
              value={contact}
              onChangeText={setContact}
              style={styles.input}
              autoCapitalize="none"
              keyboardType={contactType === 'EMAIL' ? 'email-address' : 'phone-pad'}
              autoComplete={contactType === 'EMAIL' ? 'email' : 'tel'}
              placeholder={contactType === 'EMAIL' ? 'you@example.com' : '+44…'}
            />

            {status === 'ERROR' && <Text style={styles.error}>The application could not be started. Check the details and try again.</Text>}

            <Pressable
              accessibilityRole="button"
              disabled={status === 'SUBMITTING' || preferredName.trim().length === 0 || contact.trim().length === 0}
              onPress={startApplication}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, status === 'SUBMITTING' && styles.disabled]}
            >
              {status === 'SUBMITTING' ? <ActivityIndicator /> : <Text style={styles.primaryButtonText}>Continue</Text>}
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
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

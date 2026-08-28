import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { dazatTokens } from '@dazat/design-system';

export default function RiderApp() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} accessibilityRole="summary">
        <Text style={styles.eyebrow}>ENGINEERING PHASE 0.1</Text>
        <Text style={styles.title}>DAZAT Rider</Text>
        <Text style={styles.body}>
          Production shell created. Identity and the canonical Booking API come before screen polish.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dazatTokens.color.canvas },
  container: { flex: 1, justifyContent: 'center', padding: dazatTokens.spacing[6], gap: dazatTokens.spacing[3] },
  eyebrow: { fontSize: 12, fontWeight: '600', color: dazatTokens.color.textMuted },
  title: { fontSize: 32, fontWeight: '700', color: dazatTokens.color.textPrimary },
  body: { fontSize: 16, lineHeight: 24, color: dazatTokens.color.textMuted }
});

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/useAuth';
import { colors } from '@/theme';

// Artwork is drawn on a 220×200 grid (see assets/images/dodo); K scales it on screen.
const K = 0.6;
const body = require('../../assets/images/dodo/body.svg');
const leg = require('../../assets/images/dodo/leg.svg');

// Sign up / log in, in the same look as the launch intro it follows.
export default function WelcomeScreen() {
  const { login, signUp, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // If a valid session exists or login succeeds, route to Home
  useEffect(() => {
    if (isAuthenticated) router.replace('/screens/home');
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.brand}>
        <View style={styles.bird}>
          <Image source={leg} style={[styles.leg, { left: 82 * K }]} />
          <Image source={leg} style={[styles.leg, { left: 110 * K }]} />
          <Image source={body} style={styles.body} />
        </View>
        <Text style={styles.wordmark}>dodo</Text>
        <View style={styles.line} />
        <Text style={styles.tagline}>Hands-free, voice-guided reading</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
          onPress={() => signUp()}
          accessibilityRole="button">
          <Text style={styles.primaryText}>Sign up</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
          onPress={() => login()}
          accessibilityRole="button">
          <Text style={styles.secondaryText}>Log in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  center: { justifyContent: 'center', alignItems: 'center' },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bird: { width: 220 * K, height: 200 * K, marginBottom: 20 },
  body: { position: 'absolute', top: 0, left: 0, width: 220 * K, height: 180 * K },
  leg: { position: 'absolute', top: 148 * K, width: 30 * K, height: 44 * K },
  wordmark: { color: colors.text, fontSize: 30, fontWeight: '600', letterSpacing: 6 },
  line: {
    width: 44,
    height: 2,
    borderRadius: 1,
    marginTop: 14,
    backgroundColor: colors.accent,
  },
  tagline: { color: colors.textSecondary, fontSize: 15, marginTop: 18, textAlign: 'center' },
  actions: { gap: 12, paddingBottom: 24 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.accent },
  primaryText: { color: colors.background, fontSize: 16, fontWeight: '600' },
  secondary: { backgroundColor: colors.surface },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});

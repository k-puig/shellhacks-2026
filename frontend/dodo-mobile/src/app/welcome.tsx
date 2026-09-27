import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { BrandMark, useIntroDone } from '@/components/BrandMark';
import { colors } from '@/theme';

// Matches the intro's strong ease-out.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER_MS = 420;
const STAGGER_MS = 70;

// Rises into place once the intro has handed off (fades only with Reduce Motion).
const useEnter = (progress: SharedValue<number>, reduceMotion: boolean) =>
  useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ translateY: (1 - progress.value) * 10 }],
  }));

// Sign up / log in. The brand sits exactly where the launch intro leaves it
// (same BrandMark layout), so the intro fades into this page without a jump;
// then the tagline and buttons come in and the dodo breathes while it waits.
export default function WelcomeScreen() {
  const { login, signUp, isAuthenticated } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const introDone = useIntroDone();
  const reduceMotion = useReducedMotion();

  // If a valid session exists or login succeeds, route to Home
  useEffect(() => {
    if (isAuthenticated) router.replace('/screens/home');
  }, [isAuthenticated, router]);

  const tagline = useSharedValue(0);
  const signUpButton = useSharedValue(0);
  const logInButton = useSharedValue(0);
  useEffect(() => {
    if (!introDone) return;
    const enter = { duration: reduceMotion ? 240 : ENTER_MS, easing: EASE_OUT };
    [tagline, signUpButton, logInButton].forEach((value, i) => {
      value.value = withDelay(i * STAGGER_MS, withTiming(1, enter));
    });
  }, [introDone, reduceMotion, tagline, signUpButton, logInButton]);
  const taglineStyle = useEnter(tagline, reduceMotion);
  const signUpStyle = useEnter(signUpButton, reduceMotion);
  const logInStyle = useEnter(logInButton, reduceMotion);

  return (
    <View style={styles.screen}>
      <BrandMark breathing={introDone} taglineStyle={taglineStyle} />

      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={signUpStyle}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
            onPress={() => signUp()}
            accessibilityRole="button">
            <Text style={styles.primaryText}>Sign up</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={logInStyle}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
            onPress={() => login()}
            accessibilityRole="button">
            <Text style={styles.secondaryText}>Log in</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  actions: { position: 'absolute', left: 24, right: 24, bottom: 0, gap: 12 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.accent },
  primaryText: { color: colors.background, fontSize: 16, fontWeight: '600' },
  secondary: { backgroundColor: colors.surface },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});

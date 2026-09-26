import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';

// Artwork is drawn on a 220×200 grid (see assets/images/dodo); K scales it on screen.
const K = 0.85;
const STEP_MS = 170; // one waddle step

const body = require('../../assets/images/dodo/body.svg');
const leg = require('../../assets/images/dodo/leg.svg');

// Launch intro: the dodo appears, bobs, waddles off to the right, then the
// overlay fades to reveal Home (already rendered underneath). Tap to skip.
export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const appear = useSharedValue(0);
  const x = useSharedValue(0);
  const tilt = useSharedValue(0);
  const bob = useSharedValue(0);
  const legA = useSharedValue(0);
  const legB = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const overlay = useSharedValue(1);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    timers.current.forEach(clearTimeout);
    overlay.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) });
    timers.current = [setTimeout(onDone, 340)];
  };

  useEffect(() => {
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

    // 1. Appear with a soft spring, wordmark just after.
    appear.value = withSpring(1, { damping: 14, stiffness: 140 });
    wordmark.value = withTiming(1, { duration: 400 });

    if (reduceMotion) {
      at(900, finish);
      return () => timers.current.forEach(clearTimeout);
    }

    // 2. A curious head bob.
    at(550, () => {
      tilt.value = withSequence(
        withTiming(-6, { duration: 160 }),
        withTiming(3, { duration: 160 }),
        withTiming(0, { duration: 140 }),
      );
    });

    // 3. Waddle off: rock side to side, bounce each step, alternate legs.
    at(1100, () => {
      const step = { duration: STEP_MS, easing: Easing.inOut(Easing.sin) };
      tilt.value = withRepeat(withSequence(withTiming(-7, step), withTiming(7, step)), -1, true);
      bob.value = withRepeat(
        withSequence(withTiming(-7, { duration: STEP_MS / 2 }), withTiming(0, { duration: STEP_MS / 2 })),
        -1,
      );
      legA.value = withRepeat(withSequence(withTiming(1, step), withTiming(0, step)), -1);
      legB.value = withRepeat(withSequence(withTiming(0, step), withTiming(1, step)), -1);
      wordmark.value = withTiming(0, { duration: 300 });
      x.value = withTiming(width / 2 + 200, { duration: 1500, easing: Easing.in(Easing.quad) });
    });

    // 4. Once it's off screen, reveal Home.
    at(2500, finish);

    return () => {
      timers.current.forEach(clearTimeout);
      [tilt, bob, legA, legB, x].forEach(cancelAnimation);
    };
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const birdStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateX: x.value },
      { translateY: bob.value + (1 - appear.value) * 12 },
      { rotate: `${tilt.value}deg` },
      { scale: 0.85 + 0.15 * appear.value },
    ],
  }));
  // Legs swing from the hip and lift slightly on their step.
  const legAStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * legA.value }, { rotate: `${-14 * legA.value}deg` }],
  }));
  const legBStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * legB.value }, { rotate: `${-14 * legB.value}deg` }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [{ translateY: (1 - wordmark.value) * 8 }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Pressable style={styles.center} onPress={finish} accessibilityLabel="Skip intro">
        <Animated.View style={[styles.bird, birdStyle]}>
          <Animated.View style={[styles.leg, { left: 82 * K }, legBStyle]}>
            <Image source={leg} style={styles.fill} />
          </Animated.View>
          <Animated.View style={[styles.leg, { left: 110 * K }, legAStyle]}>
            <Image source={leg} style={styles.fill} />
          </Animated.View>
          <Image source={body} style={styles.body} />
        </Animated.View>
        <Animated.View style={wordmarkStyle}>
          <Text style={styles.wordmark}>dodo</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  bird: { width: 220 * K, height: 200 * K },
  body: { position: 'absolute', top: 0, left: 0, width: 220 * K, height: 180 * K },
  leg: { position: 'absolute', top: 148 * K, width: 30 * K, height: 44 * K, transformOrigin: 'top' },
  fill: { width: '100%', height: '100%' },
  wordmark: { color: colors.text, fontSize: 34, fontWeight: '700', letterSpacing: -1 },
});

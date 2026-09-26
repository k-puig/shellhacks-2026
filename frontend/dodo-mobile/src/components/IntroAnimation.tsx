import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '@/theme';

const WORD = 'dodo';

// Strong ease-out: quick to arrive, gentle to settle.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const MARK_MS = 520;
const LETTER_DELAY_MS = 180;
const LETTER_STAGGER_MS = 60;
const LETTER_MS = 420;
const LINE_DELAY_MS = 380;
const LINE_MS = 620;
const HOLD_UNTIL_MS = 1250;
const FADE_OUT_MS = 320;

// The dodo mark (assets/images/dodo/mark.svg, a 124×140 drawing).
const markArt = require('../../assets/images/dodo/mark.svg');

function Letter({ char, progress, reduceMotion }: {
  char: string;
  progress: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ translateY: (1 - progress.value) * 6 }],
  }));
  return <Animated.Text style={[styles.wordmark, style]}>{char}</Animated.Text>;
}

// Launch intro: the dodo settles in, the wordmark resolves letter by letter
// over a thin amber rule, then the overlay fades to reveal Home (already
// rendered underneath). Tap to skip.
export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();

  const mark = useSharedValue(0);
  const letters = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const line = useSharedValue(0);
  const overlay = useSharedValue(1);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    timers.current.forEach(clearTimeout);
    overlay.value = withTiming(0, { duration: FADE_OUT_MS, easing: EASE_OUT });
    timers.current = [setTimeout(onDone, FADE_OUT_MS + 20)];
  };

  useEffect(() => {
    // Reduce Motion: the same reveal as plain fades, no movement.
    const t = (ms: number) => ({ duration: reduceMotion ? 240 : ms, easing: EASE_OUT });
    mark.value = withTiming(1, t(MARK_MS));
    letters.forEach((l, i) => {
      l.value = withDelay(LETTER_DELAY_MS + i * LETTER_STAGGER_MS, withTiming(1, t(LETTER_MS)));
    });
    line.value = withDelay(LINE_DELAY_MS, withTiming(1, t(LINE_MS)));
    timers.current.push(setTimeout(finish, HOLD_UNTIL_MS));
    return () => timers.current.forEach(clearTimeout);
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: reduceMotion
      ? []
      : [{ translateY: (1 - mark.value) * 4 }, { scale: 0.96 + 0.04 * mark.value }],
  }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? line.value : 1,
    transform: reduceMotion ? [] : [{ scaleX: line.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Pressable style={styles.center} onPress={finish} accessibilityLabel="Skip intro">
        <Animated.View style={[styles.bird, markStyle]}>
          <Image source={markArt} style={styles.fill} contentFit="contain" />
        </Animated.View>
        <View style={styles.word} accessible accessibilityLabel={WORD}>
          {WORD.split('').map((char, i) => (
            <Letter key={i} char={char} progress={letters[i]} reduceMotion={reduceMotion} />
          ))}
        </View>
        <Animated.View style={[styles.line, lineStyle]} />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bird: { width: 104, height: 117, marginBottom: 22 },
  fill: { width: '100%', height: '100%' },
  word: { flexDirection: 'row' },
  wordmark: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: 6,
  },
  // Draws from the left edge (transformOrigin) as it scales in.
  line: {
    width: 44,
    height: 2,
    borderRadius: 1,
    marginTop: 14,
    backgroundColor: colors.accent,
    transformOrigin: 'left',
  },
});

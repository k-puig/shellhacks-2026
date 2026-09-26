import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '@/theme';

// Artwork is drawn on a 220×200 grid (see assets/images/dodo); K scales it on screen.
const K = 0.6;
const WORD = 'dodo';

// Strong ease-out: quick to arrive, gentle to settle.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// Falling speeds up, like gravity.
const FALL = Easing.in(Easing.quad);

// Timeline (ms). The dodo walks in, an egg drops on its head, then the wordmark.
const MARK_MS = 420;
const WALK_MS = 900;
const WALK_DISTANCE = 56;
const STEP_MS = 150;
const EGG_DROP_AT = 1050;
const EGG_FALL_MS = 360;
const IMPACT_AT = EGG_DROP_AT + EGG_FALL_MS;
const LETTER_DELAY_MS = 1600;
const LETTER_STAGGER_MS = 60;
const LETTER_MS = 420;
const LINE_DELAY_MS = 1800;
const LINE_MS = 620;
const HOLD_UNTIL_MS = 2900;
const FADE_OUT_MS = 320;
// Reduce Motion: fades only, no walk or egg.
const CALM = { letterDelay: 180, lineDelay: 380, holdUntil: 1250 };

// Where the egg lands: the top of the head in body.svg (x 150, top y 26).
const HEAD_X = 150 * K;
const HEAD_TOP = 26 * K;
const EGG_W = 30 * K;
const EGG_H = 38 * K;
const EGG_START_Y = -240;

const body = require('../../assets/images/dodo/body.svg');
const leg = require('../../assets/images/dodo/leg.svg');
const egg = require('../../assets/images/dodo/egg.svg');

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

// Launch intro: the dodo walks in, an egg bonks it on the head, then the
// wordmark resolves over a thin amber rule and the overlay fades to reveal
// Home (already rendered underneath). Tap to skip.
export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();

  const mark = useSharedValue(0);
  const walkX = useSharedValue(reduceMotion ? 0 : -WALK_DISTANCE);
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const legA = useSharedValue(0);
  const legB = useSharedValue(0);
  const eggY = useSharedValue(EGG_START_Y);
  const eggX = useSharedValue(0);
  const eggSpin = useSharedValue(0);
  const eggOpacity = useSharedValue(0);
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
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    const t = (ms: number) => ({ duration: reduceMotion ? 240 : ms, easing: EASE_OUT });
    const letterDelay = reduceMotion ? CALM.letterDelay : LETTER_DELAY_MS;

    mark.value = withTiming(1, t(MARK_MS));
    letters.forEach((l, i) => {
      l.value = withDelay(letterDelay + i * LETTER_STAGGER_MS, withTiming(1, t(LETTER_MS)));
    });
    line.value = withDelay(reduceMotion ? CALM.lineDelay : LINE_DELAY_MS, withTiming(1, t(LINE_MS)));

    if (reduceMotion) {
      at(CALM.holdUntil, finish);
      return () => timers.current.forEach(clearTimeout);
    }

    // 1. Walk in: legs alternate, a small bob and rock with each step.
    const step = { duration: STEP_MS, easing: Easing.inOut(Easing.sin) };
    const steps = WALK_MS / (2 * STEP_MS);
    walkX.value = withTiming(0, { duration: WALK_MS, easing: Easing.out(Easing.quad) });
    legA.value = withRepeat(withSequence(withTiming(1, step), withTiming(0, step)), steps);
    legB.value = withDelay(
      STEP_MS,
      withRepeat(withSequence(withTiming(1, step), withTiming(0, step)), steps),
    );
    bob.value = withRepeat(
      withSequence(withTiming(-3, { duration: STEP_MS / 2 }), withTiming(0, { duration: STEP_MS / 2 })),
      steps * 2,
    );
    tilt.value = withSequence(
      withRepeat(withSequence(withTiming(-3, step), withTiming(3, step)), steps),
      withTiming(0, { duration: 120 }),
    );

    // 2. An egg drops from above...
    eggOpacity.value = withDelay(EGG_DROP_AT, withTiming(1, { duration: 60 }));
    eggY.value = withDelay(EGG_DROP_AT, withTiming(0, { duration: EGG_FALL_MS, easing: FALL }));

    // 3. ...bonk: the dodo squashes and wobbles; the egg bounces off, spinning away.
    at(IMPACT_AT, () => {
      squashY.value = withSequence(
        withTiming(0.9, { duration: 70 }),
        withSpring(1, { damping: 9, stiffness: 280 }),
      );
      squashX.value = withSequence(
        withTiming(1.06, { duration: 70 }),
        withSpring(1, { damping: 9, stiffness: 280 }),
      );
      tilt.value = withSequence(
        withTiming(-8, { duration: 90 }),
        withSpring(0, { damping: 7, stiffness: 200 }),
      );
      eggY.value = withSequence(
        withTiming(-36, { duration: 200, easing: EASE_OUT }),
        withTiming(130, { duration: 380, easing: FALL }),
      );
      eggX.value = withTiming(52, { duration: 580 });
      eggSpin.value = withTiming(220, { duration: 580 });
      eggOpacity.value = withDelay(420, withTiming(0, { duration: 160 }));
    });

    at(HOLD_UNTIL_MS, finish);

    return () => {
      timers.current.forEach(clearTimeout);
      [walkX, bob, tilt, squashX, squashY, legA, legB, eggY, eggX, eggSpin].forEach(cancelAnimation);
    };
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const birdStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [
      { translateX: walkX.value },
      { translateY: bob.value },
      { rotate: `${tilt.value}deg` },
      { scaleX: squashX.value },
      { scaleY: squashY.value },
    ],
  }));
  // Legs swing from the hip and lift slightly on their step.
  const legAStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * legA.value }, { rotate: `${-14 * legA.value}deg` }],
  }));
  const legBStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * legB.value }, { rotate: `${-14 * legB.value}deg` }],
  }));
  const eggStyle = useAnimatedStyle(() => ({
    opacity: eggOpacity.value,
    transform: [
      { translateX: eggX.value },
      { translateY: eggY.value },
      { rotate: `${eggSpin.value}deg` },
    ],
  }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? line.value : 1,
    transform: reduceMotion ? [] : [{ scaleX: line.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Pressable style={styles.center} onPress={finish} accessibilityLabel="Skip intro">
        <View style={styles.stage}>
          <Animated.View style={[styles.bird, birdStyle]}>
            <Animated.View style={[styles.leg, { left: 82 * K }, legBStyle]}>
              <Image source={leg} style={styles.fill} />
            </Animated.View>
            <Animated.View style={[styles.leg, { left: 110 * K }, legAStyle]}>
              <Image source={leg} style={styles.fill} />
            </Animated.View>
            <Image source={body} style={styles.body} />
          </Animated.View>
          {!reduceMotion && (
            <Animated.View style={[styles.egg, eggStyle]}>
              <Image source={egg} style={styles.fill} />
            </Animated.View>
          )}
        </View>
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
  stage: { width: 220 * K, height: 200 * K, marginBottom: 20 },
  // Squashes from the feet when the egg lands.
  bird: { width: 220 * K, height: 200 * K, transformOrigin: 'bottom' },
  body: { position: 'absolute', top: 0, left: 0, width: 220 * K, height: 180 * K },
  leg: { position: 'absolute', top: 148 * K, width: 30 * K, height: 44 * K, transformOrigin: 'top' },
  // Resting position: sitting on top of the head, bottom edge at HEAD_TOP.
  egg: {
    position: 'absolute',
    left: HEAD_X - EGG_W / 2,
    top: HEAD_TOP - EGG_H + 2,
    width: EGG_W,
    height: EGG_H,
  },
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

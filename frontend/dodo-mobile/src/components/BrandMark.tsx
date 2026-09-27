import { Image } from 'expo-image';
import { createContext, useContext, useEffect, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';

// The dodo, wordmark, amber rule and tagline, laid out identically by the
// launch intro and the welcome screen so the intro hands off without a jump:
// both fill the whole window and center the same-sized group at the same spot.

// Artwork is drawn on a 220×200 grid (see assets/images/dodo); K scales it on screen.
export const K = 0.6;
// How far above the window's center the brand sits, leaving room for the buttons.
const BRAND_LIFT = 110;
export const TAGLINE = 'Hands-free, voice-guided reading';

export const body = require('../../assets/images/dodo/body.svg');
export const leg = require('../../assets/images/dodo/leg.svg');

export const brandStyles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: BRAND_LIFT,
  },
  stage: { width: 220 * K, height: 200 * K, marginBottom: 20 },
  bird: { width: 220 * K, height: 200 * K },
  body: { position: 'absolute', top: 0, left: 0, width: 220 * K, height: 180 * K },
  leg: { position: 'absolute', top: 148 * K, width: 30 * K, height: 44 * K, transformOrigin: 'top' },
  legA: { left: 110 * K },
  legB: { left: 82 * K },
  fill: { width: '100%', height: '100%' },
  word: { flexDirection: 'row' },
  wordmark: { color: colors.text, fontSize: 30, fontWeight: '600', letterSpacing: 6 },
  line: {
    width: 44,
    height: 2,
    borderRadius: 1,
    marginTop: 14,
    backgroundColor: colors.accent,
    transformOrigin: 'left',
  },
  tagline: { color: colors.textSecondary, fontSize: 15, marginTop: 18, textAlign: 'center' },
});

// One slow breath: in, then out.
const BREATH_MS = 1800;
const BREATH_SCALE = 1.02;

// The welcome screen's brand; the intro draws the same thing animated. With
// `breathing`, the dodo's chest slowly rises and falls while the page waits.
export function BrandMark({
  breathing,
  taglineStyle,
}: {
  breathing: boolean;
  // Animated by the welcome screen as it comes in.
  taglineStyle?: ComponentProps<typeof Animated.Text>['style'];
}) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(1);
  useEffect(() => {
    if (!breathing || reduceMotion) return;
    const half = { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) };
    breath.value = withRepeat(
      withSequence(withTiming(BREATH_SCALE, half), withTiming(1, half)),
      -1,
    );
    return () => cancelAnimation(breath);
  }, [breathing, reduceMotion, breath]);
  // Grows from the feet, so it swells upward rather than floating.
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: breath.value }] }));

  return (
    <View style={brandStyles.layer} pointerEvents="none">
      <View style={brandStyles.stage}>
        <Animated.View style={[brandStyles.bird, styles.breathing, breathStyle]}>
          <View style={[brandStyles.leg, brandStyles.legB]}>
            <Image source={leg} style={brandStyles.fill} />
          </View>
          <View style={[brandStyles.leg, brandStyles.legA]}>
            <Image source={leg} style={brandStyles.fill} />
          </View>
          <Image source={body} style={brandStyles.body} />
        </Animated.View>
      </View>
      {/* Separate letters, exactly like the intro, so spacing matches to the pixel. */}
      <View style={brandStyles.word} accessible accessibilityLabel="dodo">
        {'dodo'.split('').map((char, i) => (
          <Text key={i} style={brandStyles.wordmark}>
            {char}
          </Text>
        ))}
      </View>
      <View style={brandStyles.line} />
      <Animated.Text style={[brandStyles.tagline, taglineStyle]}>{TAGLINE}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({ breathing: { transformOrigin: 'bottom' } });

// Whether the launch intro has finished, so the welcome screen can bring in
// its tagline and buttons right as the intro hands off.
export const IntroDoneContext = createContext(true);
export const useIntroDone = () => useContext(IntroDoneContext);

import { GlassView } from 'expo-glass-effect';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import { colors } from '@/theme';

// idle: the button's normal action. remove: something is selected that this
// button can delete (shows X). confirm: second tap will delete (shows trash).
export type ActionState = 'idle' | 'remove' | 'confirm';

const SIZE = 52;
const REMOVE_ICON: SymbolViewProps['name'] = { ios: 'xmark', android: 'close', web: 'close' };
const CONFIRM_ICON: SymbolViewProps['name'] = { ios: 'trash', android: 'delete', web: 'delete' };

type Props = {
  icon: SymbolViewProps['name'];
  state: ActionState;
  onPress: () => void;
  accessibilityLabel: string;
};

// Round glass button that morphs into a two-step delete: coral X, then coral trash.
export function ActionButton({ icon, state, onPress, accessibilityLabel }: Props) {
  const danger = state !== 'idle';
  const fill = useSharedValue(danger ? 1 : 0);
  const press = useSharedValue(1);
  const pop = useSharedValue(1);

  useEffect(() => {
    fill.value = withTiming(danger ? 1 : 0, { duration: 180 });
    // A small bump when it arms for deletion, so the second tap feels deliberate.
    if (state === 'confirm') {
      pop.value = withSequence(withTiming(1.1, { duration: 110 }), withSpring(1, { damping: 12 }));
    }
  }, [danger, state, fill, pop]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * pop.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.6 + 0.4 * fill.value }],
  }));

  const name = state === 'confirm' ? CONFIRM_ICON : state === 'remove' ? REMOVE_ICON : icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        state === 'confirm' ? 'Tap again to delete' : state === 'remove' ? 'Delete' : accessibilityLabel
      }
      hitSlop={8}
      onPress={onPress}
      onPressIn={() => (press.value = withTiming(0.9, { duration: 90 }))}
      onPressOut={() => (press.value = withSpring(1, { damping: 14, stiffness: 260 }))}>
      <Animated.View style={[styles.button, buttonStyle]}>
        <GlassView glassEffectStyle="clear" style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.fill, fillStyle]} />
        {/* Skip the icon's entering animation on first render; animate every swap after. */}
        <LayoutAnimationConfig skipEntering>
          <Animated.View
            key={state}
            entering={ZoomIn.springify().damping(15).stiffness(240)}
            exiting={ZoomOut.duration(120)}
            style={styles.icon}>
            <SymbolView name={name} tintColor={danger ? colors.background : colors.text} size={22} />
          </Animated.View>
        </LayoutAnimationConfig>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: SIZE / 2, backgroundColor: colors.danger },
  icon: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});

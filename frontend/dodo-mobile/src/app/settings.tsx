import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { SKIP_LOGIN } from '@/auth/config';
import { initials } from '@/auth/profile';
import { useAuth } from '@/auth/AuthProvider';
import { CommandsSheet } from '@/components/CommandsSheet';
import { VoicePicker } from '@/components/VoicePicker';
import { useLibrary } from '@/data/libraryStore';
import { MAX_RATE, MIN_RATE, voiceById, type ResumeAfterAnswer } from '@/data/settings';
import { useSettings } from '@/data/settingsStore';
import {
  colors,
  HIGHLIGHT_COLOR_NAMES,
  HIGHLIGHT_COLORS,
  withAlpha,
  type HighlightColorName,
} from '@/theme';

type Icon = SymbolViewProps['name'];
const icon = (ios: string, android: string): Icon => ({ ios, android, web: android }) as Icon;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const RESUME_CHOICES: { value: ResumeAfterAnswer; label: string }[] = [
  { value: 'short', label: '1 s' },
  { value: 'normal', label: '2 s' },
  { value: 'off', label: 'Off' },
];

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
      {footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
}

// One settings row: tinted icon, label (+ optional detail), and a control or chevron.
function Row({
  symbol,
  tint,
  label,
  detail,
  right,
  below,
  onPress,
  destructive,
  first,
}: {
  symbol: Icon;
  tint: string;
  label: string;
  detail?: string;
  right?: ReactNode;
  // Shown under the label, for controls too wide to sit beside it.
  below?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  first?: boolean;
}) {
  const body = (
    <View style={styles.row}>
      {!first && <View style={styles.divider} />}
      <View style={[styles.iconTile, { backgroundColor: withAlpha(tint, 0.18) }]}>
        <SymbolView name={symbol} tintColor={tint} size={16} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {below}
      </View>
      {right}
      {onPress && !right && (
        <SymbolView name={icon('chevron.right', 'chevron_right')} tintColor={colors.textSecondary} size={13} />
      )}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const confirm = (title: string, message: string, action: string, onConfirm: () => void) =>
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);

export default function SettingsScreen() {
  const { logout, user } = useAuth();
  const { settings, update } = useSettings();
  const library = useLibrary();
  const [showVoices, setShowVoices] = useState(false);
  const [showCommands, setShowCommands] = useState(false);

  const handleLogout = async () => {
    await logout();
    // Close this sheet and swap out the tabs under it, so the reader (and its
    // narration and mic) shuts down instead of running behind Welcome.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/welcome');
  };

  const voice = voiceById(settings.voiceId);
  const bookCount = Object.keys(library.positions).length;
  const trackColor = { true: colors.accent, false: colors.border };

  return (
    // Presented as a sheet, so no top safe-area inset is needed.
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Settings</Text>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        {/* Account */}
        <View style={[styles.card, styles.account]}>
          {user?.picture ? (
            <Image source={user.picture} style={styles.avatar} accessibilityLabel="Profile picture" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              {user ? (
                <Text style={styles.avatarInitials}>{initials(user.name)}</Text>
              ) : (
                <SymbolView name={icon('person.fill', 'person')} tintColor={colors.textSecondary} size={26} />
              )}
            </View>
          )}
          <View style={styles.rowText}>
            <Text style={styles.accountName} numberOfLines={1}>
              {user?.name ?? (SKIP_LOGIN ? 'Guest' : 'Signed in')}
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
              {user?.email ?? (SKIP_LOGIN ? 'Login skipped for local testing' : '')}
            </Text>
          </View>
        </View>
        {!SKIP_LOGIN && (
          <Pressable
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
            onPress={handleLogout}
            accessibilityRole="button">
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        )}

        <Section title="Listening">
          <Row
            first
            symbol={icon('waveform', 'graphic_eq')}
            tint={colors.accent}
            label="Voice"
            detail={voice.description ? `${voice.name} · ${voice.description}` : voice.name}
            onPress={() => setShowVoices(true)}
          />
          <Row
            symbol={icon('speedometer', 'speed')}
            tint={HIGHLIGHT_COLORS.blue}
            label="Speed"
            right={
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepperButton}
                  disabled={settings.rate <= MIN_RATE}
                  onPress={() => update({ rate: settings.rate - 0.1 })}
                  accessibilityRole="button"
                  accessibilityLabel="Slower">
                  <Text style={[styles.stepperSign, settings.rate <= MIN_RATE && styles.disabled]}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{settings.rate.toFixed(1)}×</Text>
                <Pressable
                  style={styles.stepperButton}
                  disabled={settings.rate >= MAX_RATE}
                  onPress={() => update({ rate: settings.rate + 0.1 })}
                  accessibilityRole="button"
                  accessibilityLabel="Faster">
                  <Text style={[styles.stepperSign, settings.rate >= MAX_RATE && styles.disabled]}>+</Text>
                </Pressable>
              </View>
            }
          />
          <Row
            symbol={icon('arrow.uturn.backward', 'replay')}
            tint={HIGHLIGHT_COLORS.green}
            label="After answers"
            detail="When the book picks back up"
            right={
              <View style={styles.segments}>
                {RESUME_CHOICES.map(({ value, label }) => {
                  const on = settings.resumeAfterAnswer === value;
                  return (
                    <Pressable
                      key={value}
                      style={[styles.segment, on && styles.segmentOn]}
                      onPress={() => update({ resumeAfterAnswer: value })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}>
                      <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            }
          />
        </Section>

        <Section
          title="Voice control"
          footer="With “Hey DODO” off, tap the mic in the reader to give a command.">
          <Row
            first
            symbol={icon('mic.fill', 'mic')}
            tint={HIGHLIGHT_COLORS.purple}
            label="Listen for “Hey DODO”"
            right={
              <Switch
                value={settings.wakeWord}
                onValueChange={(wakeWord) => update({ wakeWord })}
                trackColor={trackColor}
              />
            }
          />
          <Row
            symbol={icon('hand.tap.fill', 'touch_app')}
            tint={HIGHLIGHT_COLORS.pink}
            label="Haptics"
            right={
              <Switch
                value={settings.haptics}
                onValueChange={(haptics) => update({ haptics })}
                trackColor={trackColor}
              />
            }
          />
          <Row
            symbol={icon('questionmark.bubble.fill', 'help')}
            tint={HIGHLIGHT_COLORS.blue}
            label="What can I say?"
            onPress={() => setShowCommands(true)}
          />
        </Section>

        <Section title="Reading">
          <Row
            first
            symbol={icon('highlighter', 'ink_highlighter')}
            tint={HIGHLIGHT_COLORS[settings.highlightColor]}
            label="Highlight color"
            below={
              <View style={styles.dots}>
                {HIGHLIGHT_COLOR_NAMES.map((name: HighlightColorName) => {
                  const on = settings.highlightColor === name;
                  return (
                    <Pressable
                      key={name}
                      hitSlop={4}
                      onPress={() => update({ highlightColor: name })}
                      accessibilityRole="button"
                      accessibilityLabel={`${name} highlights`}
                      accessibilityState={{ selected: on }}
                      style={[styles.dotRing, on && { borderColor: HIGHLIGHT_COLORS[name] }]}>
                      <View style={[styles.dot, { backgroundColor: HIGHLIGHT_COLORS[name] }]} />
                    </Pressable>
                  );
                })}
              </View>
            }
          />
        </Section>

        <Section title="Your data">
          <Row
            first
            symbol={icon('trash', 'delete')}
            tint={colors.danger}
            destructive
            label="Clear highlights & notes"
            detail={`${plural(library.highlights.length, 'highlight')} · ${plural(library.notes.length, 'note')}`}
            onPress={() =>
              confirm('Clear highlights & notes?', 'This removes them from every book.', 'Clear', library.clearHighlightsAndNotes)
            }
          />
          <Row
            symbol={icon('bubble.left.and.bubble.right', 'forum')}
            tint={colors.danger}
            destructive
            label="Clear Ask DODO history"
            detail={plural(library.askedQuestions.length, 'question')}
            onPress={() =>
              confirm('Clear Ask DODO history?', 'This removes every saved question and answer.', 'Clear', library.clearAskedQuestions)
            }
          />
          <Row
            symbol={icon('arrow.counterclockwise', 'restart_alt')}
            tint={colors.danger}
            destructive
            label="Reset all reading progress"
            detail={bookCount ? `${plural(bookCount, 'book')} in progress` : 'Nothing to reset'}
            onPress={() =>
              confirm('Reset all reading progress?', 'Every book starts over from the beginning.', 'Reset', library.clearAllPositions)
            }
          />
        </Section>

        <Section title="About" footer="Narration by ElevenLabs · Answers by Gemini">
          <Row
            first
            symbol={icon('info.circle.fill', 'info')}
            tint={colors.textSecondary}
            label="DODO"
            detail={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`}
          />
        </Section>
      </ScrollView>

      <VoicePicker
        visible={showVoices}
        selectedId={settings.voiceId}
        onSelect={(voiceId) => update({ voiceId })}
        onClose={() => setShowVoices(false)}
      />
      <CommandsSheet visible={showCommands} onClose={() => setShowCommands(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 28, paddingBottom: 48 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  done: { color: colors.accent, fontSize: 17, fontWeight: '600' },

  account: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: colors.text, fontSize: 19, fontWeight: '600' },
  accountName: { color: colors.text, fontSize: 18, fontWeight: '600' },
  logout: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },

  section: { marginTop: 28, gap: 8 },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  footer: { color: colors.textSecondary, fontSize: 13, marginLeft: 4, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 14 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  // Inset under the label, iOS style.
  divider: {
    position: 'absolute',
    top: 0,
    left: 56,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  iconTile: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 16 },
  detail: { color: colors.textSecondary, fontSize: 13 },
  destructive: { color: colors.danger },
  pressed: { opacity: 0.7 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  stepperButton: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepperSign: { color: colors.accent, fontSize: 20, fontWeight: '500' },
  stepperValue: { color: colors.text, fontSize: 15, fontWeight: '600', minWidth: 38, textAlign: 'center' },
  disabled: { color: colors.border },

  segments: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 2 },
  segment: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  segmentOn: { backgroundColor: colors.surface },
  segmentText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  segmentTextOn: { color: colors.accent },

  dots: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dotRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 16, height: 16, borderRadius: 8 },
});

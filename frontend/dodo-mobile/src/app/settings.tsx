import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

// Static for the MVP — these become real preferences later.
const groups: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Narration',
    rows: [
      ['Voice', 'System default'],
      ['Speed', '1.0×  (say “faster” / “slower”)'],
    ],
  },
  {
    title: 'Voice commands',
    rows: [
      ['Wake word', 'Hey DODO'],
      ['“highlight that”', 'Highlight the last sentence'],
      ['“write a note, …”', 'Save a note here'],
      ['“pause” / “keep reading”', 'Stop or resume'],
      ['“go back” / “skip”', 'Repeat sentence / next paragraph'],
      ['“next chapter”', 'Jump chapters'],
    ],
  },
  {
    title: 'Account',
    rows: [
      ['Signed in as', 'Guest'],
      ['Sync', 'Off'],
    ],
  },
];

export default function SettingsScreen() {
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
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.card}>
              {group.rows.map(([label, value], i) => (
                <View key={label} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.value}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 28, paddingBottom: 40 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  done: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  group: { marginBottom: 28 },
  groupTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  label: { color: colors.text, fontSize: 15, flexShrink: 1 },
  value: { color: colors.textSecondary, fontSize: 15, flexShrink: 1, textAlign: 'right' },
});

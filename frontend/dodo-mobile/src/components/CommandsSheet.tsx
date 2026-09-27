import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

// Everything you can say after "Hey DODO" (or after tapping the mic).
const GROUPS: { title: string; commands: [string, string][] }[] = [
  {
    title: 'Playback',
    commands: [
      ['“pause” · “play”', 'Stop or keep reading'],
      ['“go back” · “skip”', 'Repeat the sentence · next paragraph'],
      ['“next chapter” · “previous chapter”', 'Jump chapters'],
      ['“faster” · “slower”', 'Change the reading speed'],
    ],
  },
  {
    title: 'Highlights & notes',
    commands: [
      ['“highlight that”', 'The sentence just read'],
      ['“highlight the part about …”', 'Finds it in what you just heard'],
      ['“highlight that in blue”', 'Any highlight color'],
      ['“note …”', 'Saves a note right here'],
    ],
  },
  {
    title: 'Questions',
    commands: [
      ['“why …?” · “who is …?”', 'DODO answers from what you’ve read'],
      ['“what does … mean?”', 'Explains a word in context'],
      ['“what happened in the last chapter?”', 'A quick recap, no spoilers'],
    ],
  },
];

export function CommandsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.heading}>What can I say?</Text>
          <Pressable hitSlop={10} onPress={onClose} accessibilityRole="button">
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Start with “Hey DODO”, or tap the mic, then say:</Text>

        <ScrollView contentContainerStyle={styles.content}>
          {GROUPS.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.card}>
                {group.commands.map(([say, does], i) => (
                  <View key={say} style={[styles.row, i > 0 && styles.rowDivider]}>
                    <Text style={styles.say}>{say}</Text>
                    <Text style={styles.does}>{does}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heading: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  done: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  hint: { color: colors.textSecondary, fontSize: 14, paddingHorizontal: 20, marginTop: 6 },
  content: { padding: 20, paddingBottom: 40, gap: 24 },
  group: { gap: 8 },
  groupTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  card: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16 },
  row: { paddingVertical: 12, gap: 3 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  say: { color: colors.text, fontSize: 15, fontWeight: '600' },
  does: { color: colors.textSecondary, fontSize: 14 },
});

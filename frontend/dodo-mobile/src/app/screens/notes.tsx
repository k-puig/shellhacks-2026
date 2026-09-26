import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollViewMarker } from 'react-native-screens/experimental';

import { useLibrary } from '@/data/libraryStore';
import { getBook } from '@/data/mockBooks';
import { colors } from '@/theme';

export default function NotesScreen() {
  const { currentBookId, highlights, notes } = useLibrary();
  const book = getBook(currentBookId);
  const words = book.chapters.flatMap((c) => c.paragraphs.flatMap((p) => p.words));
  const textBetween = (start: number, end: number) =>
    words
      .filter((w) => w.idx >= start && w.idx <= end)
      .map((w) => w.text)
      .join(' ');

  // One feed, ordered by where each item sits in the book.
  const items = [
    ...highlights
      .filter((h) => h.bookId === book.id)
      .map((h) => ({
        id: h.id,
        at: h.startIdx,
        kind: 'Highlight',
        body: textBetween(h.startIdx, h.endIdx),
        context: '',
      })),
    ...notes
      .filter((n) => n.bookId === book.id)
      .map((n) => ({
        id: n.id,
        at: n.wordIdx,
        kind: 'Note',
        body: n.content,
        context: textBetween(n.wordIdx - 4, n.wordIdx),
      })),
  ].sort((a, b) => a.at - b.at);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* No iOS 26 blur band under the tab bar; content runs to the bottom edge. */}
      <ScrollViewMarker scrollEdgeEffects={{ bottom: 'hidden' }} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Notes</Text>
          <Text style={styles.subtitle}>{book.title}</Text>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyBody}>
                While listening, say “Hey DODO, highlight that” or “Hey DODO, write a note…”
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.kind}>{item.kind}</Text>
                <Text style={[styles.body, item.kind === 'Highlight' && styles.quote]}>
                  {item.body}
                </Text>
                {item.context !== '' && <Text style={styles.context}>at “…{item.context}”</Text>}
              </View>
            ))
          )}
        </ScrollView>
      </ScrollViewMarker>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  title: { color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  subtitle: { color: colors.textSecondary, fontSize: 15, marginBottom: 12 },
  empty: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 6 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  emptyBody: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  kind: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  body: { color: colors.text, fontSize: 16, lineHeight: 23 },
  quote: { fontStyle: 'italic' },
  context: { color: colors.textSecondary, fontSize: 13 },
});

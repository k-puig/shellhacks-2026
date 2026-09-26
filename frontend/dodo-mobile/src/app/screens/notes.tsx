import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollViewMarker } from 'react-native-screens/experimental';

import { BookCover } from '@/components/BookCover';
import { useLibrary } from '@/data/libraryStore';
import { mockBooks } from '@/data/mockBooks';
import { groupSavedByBook } from '@/data/savedByBook';
import { colors } from '@/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function NotesScreen() {
  const { currentBookId, highlights, notes } = useLibrary();
  // One section per book, the one being read first.
  const groups = groupSavedByBook(mockBooks, highlights, notes, currentBookId);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* No iOS 26 blur band under the tab bar; content runs to the bottom edge. */}
      <ScrollViewMarker scrollEdgeEffects={{ bottom: 'hidden' }} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Notes</Text>
            {groups.length > 0 && (
              <Text style={styles.subtitle}>Across {plural(groups.length, 'book')}</Text>
            )}
          </View>

          {groups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyBody}>
                While listening, say “Hey DODO, highlight that” or “Hey DODO, write a note…”
              </Text>
            </View>
          ) : (
            groups.map(({ book, highlightCount, noteCount, items }) => (
              <View key={book.id} style={styles.section}>
                <View style={styles.bookHeader}>
                  <BookCover book={book} style={styles.cover} />
                  <View style={styles.bookInfo}>
                    <Text style={styles.bookTitle} numberOfLines={2}>
                      {book.title}
                    </Text>
                    <Text style={styles.bookMeta} numberOfLines={1}>
                      {book.author} · {plural(highlightCount, 'highlight')} ·{' '}
                      {plural(noteCount, 'note')}
                    </Text>
                  </View>
                </View>

                {items.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.card, { borderLeftColor: item.color ?? colors.accent }]}>
                    <Text style={styles.kind}>
                      {item.kind === 'highlight' ? 'Highlight' : 'Note'} · {item.chapterTitle}
                    </Text>
                    <Text style={[styles.body, item.kind === 'highlight' && styles.quote]}>
                      {item.body}
                    </Text>
                    {item.context !== '' && (
                      <Text style={styles.context}>at “…{item.context}”</Text>
                    )}
                  </View>
                ))}
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
  content: { padding: 20, paddingBottom: 40, gap: 28 },
  title: { color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  header: { gap: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 15 },
  section: { gap: 12 },
  bookHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 44, height: 64, borderRadius: 6 },
  bookInfo: { flex: 1, gap: 2 },
  bookTitle: { color: colors.text, fontSize: 19, fontWeight: '600' },
  bookMeta: { color: colors.textSecondary, fontSize: 13 },
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

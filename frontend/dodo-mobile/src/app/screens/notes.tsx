import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollViewMarker } from 'react-native-screens/experimental';

import { BookCover } from '@/components/BookCover';
import { useLibrary } from '@/data/libraryStore';
import type { Book } from '@/data/mockBooks';
import { groupQuestionsByBook, groupSavedByBook } from '@/data/savedByBook';
import { colors } from '@/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function BookHeader({ book, meta }: { book: Book; meta: string }) {
  return (
    <View style={styles.bookHeader}>
      <BookCover book={book} style={styles.cover} />
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.bookMeta} numberOfLines={1}>
          {book.author} · {meta}
        </Text>
      </View>
    </View>
  );
}

export default function NotesScreen() {
  const { books, currentBookId, highlights, notes, askedQuestions, removeAskedQuestion } = useLibrary();
  // One section per book, the one being read first.
  const groups = groupSavedByBook(books, highlights, notes, currentBookId);
  const [tab, setTab] = useState<'saved' | 'ask'>('saved');
  const questionGroups = groupQuestionsByBook(books, askedQuestions, currentBookId);
  const bookCount = tab === 'saved' ? groups.length : questionGroups.length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* No iOS 26 blur band under the tab bar; content runs to the bottom edge. */}
      <ScrollViewMarker scrollEdgeEffects={{ bottom: 'hidden' }} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Notes</Text>
            {bookCount > 0 && (
              <Text style={styles.subtitle}>Across {plural(bookCount, 'book')}</Text>
            )}
            <View style={styles.tabs} accessibilityRole="tablist">
              {(['saved', 'ask'] as const).map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t }}
                  onPress={() => setTab(t)}
                  style={[styles.tab, tab === t && styles.tabActive]}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === 'saved' ? 'Saved' : 'Ask DODO'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {tab === 'saved' &&
            (groups.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nothing saved yet</Text>
                <Text style={styles.emptyBody}>
                  While listening, say “Hey DODO, highlight that” or “Hey DODO, write a note…”
                </Text>
              </View>
            ) : (
              groups.map(({ book, highlightCount, noteCount, items }) => (
                <View key={book.id} style={styles.section}>
                  <BookHeader
                    book={book}
                    meta={`${plural(highlightCount, 'highlight')} · ${plural(noteCount, 'note')}`}
                  />
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
            ))}

          {tab === 'ask' &&
            (questionGroups.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No questions yet</Text>
                <Text style={styles.emptyBody}>
                  While listening, ask “Hey DODO, why is the Rabbit in such a hurry?” and the answer
                  will be saved here.
                </Text>
              </View>
            ) : (
              questionGroups.map(({ book, items }) => (
                <View key={book.id} style={styles.section}>
                  <BookHeader book={book} meta={plural(items.length, 'question')} />
                  {items.map((item) => (
                    <View key={item.id} style={styles.card}>
                      <Text style={styles.kind}>{item.title}</Text>
                      <Text style={styles.question}>You asked: “{item.question}”</Text>
                      <Text style={styles.body}>{item.answer}</Text>
                      <View style={styles.cardFooter}>
                        <Text style={[styles.context, styles.footerContext]} numberOfLines={1}>
                          {item.chapterTitle} · at “…{item.passage}”
                        </Text>
                        <Pressable
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete “${item.title}”`}
                          onPress={() => removeAskedQuestion(item.id)}>
                          <Text style={styles.delete}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            ))}
        </ScrollView>
      </ScrollViewMarker>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: colors.background },
  tabText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  question: { color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  delete: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  footerContext: { flex: 1 },
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

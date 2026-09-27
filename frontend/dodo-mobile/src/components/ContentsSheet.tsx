import { SymbolView } from 'expo-symbols';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Book } from '@/data/mockBooks';
import {
  bookProgress,
  chapterIndexAt,
  chapterProgress,
  chapterStart,
  type Position,
} from '@/data/readingProgress';
import { colors } from '@/theme';

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

// Table of contents: pick up where you left off, or jump to any chapter, with
// how much of each chapter (and the book) has been listened to.
export function ContentsSheet({
  visible,
  book,
  position,
  onSelect,
  onClose,
  onReset,
}: {
  visible: boolean;
  book: Book;
  position: Position | undefined;
  // Called with the word to continue from.
  onSelect: (idx: number) => void;
  onClose: () => void;
  // Forget this book's progress and start over.
  onReset: () => void;
}) {
  const furthest = position?.furthestIdx ?? -1;
  const perChapter = chapterProgress(book, furthest);
  const resumeIdx = position?.lastIdx ?? 0;
  const resumeChapter = chapterIndexAt(book, resumeIdx);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.heading}>Contents</Text>
          <Pressable hitSlop={10} onPress={onClose} accessibilityRole="button">
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.book}>
            <Text style={styles.bookTitle}>{book.title}</Text>
            <ProgressBar value={bookProgress(book, furthest)} />
            <Text style={styles.meta}>{percent(bookProgress(book, furthest))} listened</Text>
          </View>

          <Pressable
            style={styles.resume}
            accessibilityRole="button"
            accessibilityLabel={`Continue listening at ${book.chapters[resumeChapter].title}`}
            onPress={() => onSelect(resumeIdx)}>
            <View style={styles.resumeIcon}>
              <SymbolView
                name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                tintColor={colors.background}
                size={16}
              />
            </View>
            <View style={styles.resumeText}>
              <Text style={styles.resumeLabel}>
                {position ? 'Continue listening' : 'Start listening'}
              </Text>
              <Text style={styles.resumeChapter} numberOfLines={1}>
                {book.chapters[resumeChapter].title} · {percent(perChapter[resumeChapter])}
              </Text>
            </View>
          </Pressable>

          {book.chapters.map((chapter, i) => {
            const done = perChapter[i] >= 1;
            const current = i === resumeChapter;
            return (
              <Pressable
                key={chapter.chapterIdx}
                style={[styles.row, current && styles.rowCurrent]}
                accessibilityRole="button"
                accessibilityLabel={`${chapter.title}, ${percent(perChapter[i])} listened`}
                // Your own chapter continues where you are; others start at the top.
                onPress={() => onSelect(current ? resumeIdx : chapterStart(book, i))}>
                <Text style={[styles.mark, done && styles.markDone]}>
                  {done ? '✓' : current ? '●' : ''}
                </Text>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, current && styles.rowTitleCurrent]} numberOfLines={2}>
                    {chapter.title}
                  </Text>
                  <ProgressBar value={perChapter[i]} />
                </View>
              </Pressable>
            );
          })}

          {position && (
            <Pressable
              style={styles.reset}
              accessibilityRole="button"
              onPress={() =>
                Alert.alert('Reset progress?', `Start ${book.title} over from the beginning.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: onReset },
                ])
              }>
              <Text style={styles.resetText}>Reset progress</Text>
            </Pressable>
          )}
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
    paddingBottom: 8,
  },
  heading: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  done: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 6 },
  book: { gap: 8, marginBottom: 16 },
  bookTitle: { color: colors.textSecondary, fontSize: 15 },
  meta: { color: colors.textSecondary, fontSize: 13 },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  resumeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeText: { flex: 1, gap: 2 },
  resumeLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  resumeChapter: { color: colors.textSecondary, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderRadius: 10 },
  rowCurrent: { backgroundColor: colors.surface },
  mark: { width: 20, textAlign: 'center', color: colors.accent, fontSize: 14 },
  markDone: { color: colors.textSecondary },
  rowBody: { flex: 1, gap: 6, paddingRight: 10 },
  rowTitle: { color: colors.text, fontSize: 16 },
  rowTitleCurrent: { color: colors.accent, fontWeight: '600' },
  reset: { alignSelf: 'center', marginTop: 24, padding: 12 },
  resetText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.border },
  fill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
});

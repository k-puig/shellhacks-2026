import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollViewMarker } from 'react-native-screens/experimental';

import { BookCover } from '@/components/BookCover';
import { useLibrary } from '@/data/libraryStore';
import { getBook, mockBooks, type Book } from '@/data/mockBooks';
import { colors } from '@/theme';

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

export default function HomeScreen() {
  const { currentBookId, openBook } = useLibrary();
  const current = getBook(currentBookId);

  const open = (book: Book) => {
    openBook(book.id);
    router.navigate('/screens/reader');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* No iOS 26 blur band under the tab bar; content runs to the bottom edge. */}
      <ScrollViewMarker scrollEdgeEffects={{ bottom: 'hidden' }} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.brand}>dodo</Text>
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Settings">
              <SymbolView
                name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
                tintColor={colors.textSecondary}
                size={24}
              />
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Continue listening</Text>
          <Pressable style={styles.hero} onPress={() => open(current)}>
            <BookCover book={current} style={styles.heroCover} />
            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {current.title}
              </Text>
              <Text style={styles.author}>{current.author}</Text>
              <ProgressBar value={current.progress} />
              <Text style={styles.hint}>Say “Hey DODO, keep reading”</Text>
            </View>
          </Pressable>

          <Text style={styles.sectionLabel}>Library</Text>
          <View style={styles.grid}>
            {mockBooks.map((book) => (
              <Pressable key={book.id} style={styles.gridItem} onPress={() => open(book)}>
                <BookCover book={book} style={styles.cover} />
                <Text style={styles.gridTitle} numberOfLines={2}>
                  {book.title}
                </Text>
                <Text style={styles.author} numberOfLines={1}>
                  {book.author}
                </Text>
                <ProgressBar value={book.progress} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </ScrollViewMarker>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  brand: { color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  hero: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
  },
  heroCover: { width: 96, height: 136 },
  heroInfo: { flex: 1, gap: 6, justifyContent: 'center' },
  heroTitle: { color: colors.text, fontSize: 19, fontWeight: '600' },
  author: { color: colors.textSecondary, fontSize: 13 },
  hint: { color: colors.accent, fontSize: 13, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 24 },
  gridItem: { width: '47%', gap: 6 },
  cover: { aspectRatio: 0.7 },
  gridTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 4 },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
});

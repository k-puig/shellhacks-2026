import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollViewMarker } from 'react-native-screens/experimental';

import { listBooks, type RemoteBook } from '@/api/books';
import { useAuth } from '@/auth/AuthProvider';
import { isApiConfigured } from '@/api/client';
import { useApi } from '@/api/useApi';
import { BookCover } from '@/components/BookCover';
import { EpubError } from '@/data/epub';
import { useLibrary } from '@/data/libraryStore';
import type { Book } from '@/data/mockBooks';
import { pickEpubBook } from '@/data/pickEpub';
import { loadRemoteBookIds } from '@/data/remoteBookIds';
import { syncImportedBook } from '@/data/syncImportedBook';
import { bookProgress } from '@/data/readingProgress';
import { colors } from '@/theme';

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

export default function HomeScreen() {
  const { books, getBook, addBook, currentBookId, openBook, positions } = useLibrary();
  // Real listening progress, from the furthest point reached in each book.
  const progressOf = (book: Book) => bookProgress(book, positions[book.id]?.furthestIdx ?? -1);
  const current = getBook(currentBookId);
  const [adding, setAdding] = useState(false);
  const api = useApi();
  const { user } = useAuth();
  const subject = user?.sub;
  const [remoteBooks, setRemoteBooks] = useState<RemoteBook[]>([]);
  const [remoteIds, setRemoteIds] = useState<Record<string, string>>({});
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRemoteBooks([]);
    setRemoteIds({});
    setSyncMessage(null);
    if (subject && isApiConfigured()) {
      void loadRemoteBookIds(subject).then((ids) => {
        if (active) setRemoteIds((current) => ({ ...ids, ...current }));
      });
      void listBooks(api).then(
        (books) => { if (active) setRemoteBooks(books); },
        (error) => { if (active) setSyncMessage(`Account books unavailable: ${String(error)}`); },
      );
    }
    return () => { active = false; };
  }, [api, subject]);

  const open = (book: Book) => {
    openBook(book.id);
    router.navigate('/screens/reader');
  };

  const addFromFiles = async () => {
    setAdding(true);
    try {
      const picked = await pickEpubBook();
      if (!picked) return;
      const inLibrary = addBook(picked.book, picked.cover);
      const alreadyLocal = inLibrary.id !== picked.book.id;
      // The picked file is available now even if an earlier upload failed.
      if (isApiConfigured() && subject) {
        try {
          const result = await syncImportedBook(api, subject, inLibrary, picked.fileUri);
          if (result.status === 'uploaded') {
            setRemoteIds((ids) => ({ ...ids, [inLibrary.id]: result.remote.id }));
            setRemoteBooks((books) => [result.remote, ...books.filter((b) => b.id !== result.remote.id)]);
          }
          setSyncMessage(null);
          if (alreadyLocal) {
            Alert.alert('Already on this phone', result.status === 'uploaded'
              ? `“${inLibrary.title}” is now synced to your account.`
              : `“${inLibrary.title}” is already saved and synced.`);
          }
        } catch (error) {
          setSyncMessage(`Saved on this phone, but not synced to your account: ${String(error)}. Reimport the EPUB to retry.`);
          if (alreadyLocal) Alert.alert('Still on this phone', 'Account sync failed. Reimport the EPUB to retry.');
        }
      } else {
        setSyncMessage(alreadyLocal
          ? 'Already on this phone. Sign in and reimport the EPUB to sync.'
          : 'Saved on this phone only. Sign in and reimport the EPUB to sync.');
        if (alreadyLocal) Alert.alert('Already on this phone', `“${inLibrary.title}” is still available offline.`);
      }
    } catch (error) {
      Alert.alert(
        "Couldn't add this book",
        error instanceof EpubError ? error.message : 'Something went wrong reading the file. Try another EPUB.',
      );
      console.warn('[dodo] Could not add book:', String(error));
    } finally {
      setAdding(false);
    }
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
              <ProgressBar value={progressOf(current)} />
              <Text style={styles.hint}>Say “Hey DODO, keep reading”</Text>
            </View>
          </Pressable>

          {isApiConfigured() && subject && (
            <View style={styles.accountSection}>
              <Text style={styles.sectionLabel}>Account books</Text>
              {remoteBooks.map((book) => (
                <Text key={book.id} style={styles.accountBook}>
                  {book.title} · {book.author} — {Object.values(remoteIds).includes(book.id)
                    ? 'offline copy on this phone'
                    : 'on account (download not yet available)'}
                </Text>
              ))}
              {!remoteBooks.length && <Text style={styles.author}>No account books loaded yet.</Text>}
            </View>
          )}
          {syncMessage && <Text style={styles.syncMessage}>{syncMessage}</Text>}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, styles.sectionLabelInRow]}>On this phone</Text>
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              onPress={addFromFiles}
              disabled={adding}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add a book from an EPUB file">
              {adding ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={colors.accent} size={15} />
              )}
              <Text style={styles.addLabel}>{adding ? 'Adding…' : 'Add book'}</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {books.map((book) => (
              <Pressable key={book.id} style={styles.gridItem} onPress={() => open(book)}>
                <BookCover book={book} style={styles.cover} />
                <Text style={styles.gridTitle} numberOfLines={2}>
                  {book.title}
                </Text>
                <Text style={styles.author} numberOfLines={1}>
                  {book.author}
                </Text>
                <ProgressBar value={progressOf(book)} />
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
  accountSection: { marginBottom: 24, gap: 8 },
  accountBook: { color: colors.text, fontSize: 14 },
  syncMessage: { color: colors.textSecondary, marginBottom: 16 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabelInRow: { marginBottom: 0 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addLabel: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
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

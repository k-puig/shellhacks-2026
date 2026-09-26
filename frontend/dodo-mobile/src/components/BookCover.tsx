import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Book } from '@/data/mockBooks';

// Cover art from the EPUB, falling back to a tinted tile with the title's
// initial when the book has no cover or it fails to load.
export function BookCover({ book, style }: { book: Book; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  const showImage = book.coverUrl && !failed;

  return (
    <View style={[styles.cover, { backgroundColor: book.coverColor }, style]}>
      {showImage ? (
        <Image
          source={book.coverUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          accessibilityLabel={`Cover of ${book.title}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={styles.initial}>{book.title[0]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initial: { color: 'rgba(242, 237, 228, 0.85)', fontSize: 40, fontWeight: '300' },
});

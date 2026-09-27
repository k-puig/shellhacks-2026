import { Directory, File, Paths } from 'expo-file-system';

import type { EpubCover } from './epub';
import type { Book } from './mockBooks';

// Books the listener added (converted from EPUB), saved on the phone as
// books/<id>.json (+ books/<id>-cover.jpg) so they open offline and survive
// closing the app. Cover paths are found again at launch, never stored: iOS
// can move the app's folder when the app updates.
const booksDir = () => new Directory(Paths.document, 'books');
const COVER_FILE = /^(.+)-cover\.(jpg|png|gif|webp)$/;

const isBook = (raw: unknown): raw is Book =>
  typeof raw === 'object' &&
  raw !== null &&
  typeof (raw as Book).id === 'string' &&
  typeof (raw as Book).title === 'string' &&
  Array.isArray((raw as Book).chapters) &&
  (raw as Book).chapters.length > 0;

export async function loadImportedBooks(): Promise<Book[]> {
  try {
    const dir = booksDir();
    if (!dir.exists) return [];
    const files = dir.list().filter((f): f is File => f instanceof File);
    const covers = new Map(
      files.flatMap((f) => {
        const match = COVER_FILE.exec(f.name);
        return match ? [[match[1], f.uri] as const] : [];
      }),
    );
    const books = await Promise.all(
      files
        .filter((f) => f.name.endsWith('.json'))
        .map(async (file) => {
          try {
            const raw: unknown = JSON.parse(await file.text());
            if (!isBook(raw)) return null;
            const coverUrl = covers.get(raw.id);
            return coverUrl ? { ...raw, coverUrl } : raw;
          } catch {
            return null;
          }
        }),
    );
    return books.filter((b): b is Book => b !== null);
  } catch (error) {
    console.log('[dodo] Could not read added books:', String(error));
    return [];
  }
}

// Saves the book and its cover; returns the book with its cover attached.
export function saveImportedBook(book: Book, cover: EpubCover | null): Book {
  const dir = booksDir();
  if (!dir.exists) dir.create();

  let coverUrl: string | undefined;
  if (cover) {
    const coverFile = new File(dir, `${book.id}-cover.${cover.ext}`);
    if (!coverFile.exists) coverFile.create();
    coverFile.write(cover.data);
    coverUrl = coverFile.uri;
  }

  const { coverUrl: _path, ...stored } = book;
  const file = new File(dir, `${book.id}.json`);
  if (!file.exists) file.create();
  file.write(JSON.stringify(stored));
  return coverUrl ? { ...book, coverUrl } : book;
}

import type { Book, Highlight, Note } from './mockBooks';

type Saved<T> = T & { bookId: string };

export type SavedItem = {
  id: string;
  kind: 'highlight' | 'note';
  chapterTitle: string;
  // Highlighted text, or the note itself.
  body: string;
  // For notes: the words just before where the note was taken.
  context: string;
  // Highlights keep their color; notes use the accent color.
  color: string | undefined;
};

export type BookGroup = {
  book: Book;
  highlightCount: number;
  noteCount: number;
  items: SavedItem[];
};

// Groups saved highlights and notes by book for the Notes screen: the book
// being read first, then the rest by title; books with nothing saved are left out.
export function groupSavedByBook(
  books: Book[],
  highlights: Saved<Highlight>[],
  notes: Saved<Note>[],
  currentBookId: string,
): BookGroup[] {
  const groups: BookGroup[] = [];
  for (const book of books) {
    const bookHighlights = highlights.filter((h) => h.bookId === book.id);
    const bookNotes = notes.filter((n) => n.bookId === book.id);
    if (bookHighlights.length + bookNotes.length === 0) continue;

    const words = book.chapters.flatMap((c) => c.paragraphs.flatMap((p) => p.words));
    const textBetween = (start: number, end: number) =>
      words
        .filter((w) => w.idx >= start && w.idx <= end)
        .map((w) => w.text)
        .join(' ');
    const chapterOf = (idx: number) =>
      book.chapters.findLast((c) => (c.paragraphs[0]?.words[0]?.idx ?? Infinity) <= idx)?.title ??
      book.chapters[0]?.title ??
      '';

    const items = [
      ...bookHighlights.map((h) => ({
        at: h.startIdx,
        item: {
          id: h.id,
          kind: 'highlight' as const,
          chapterTitle: chapterOf(h.startIdx),
          body: textBetween(h.startIdx, h.endIdx),
          context: '',
          color: h.color,
        },
      })),
      ...bookNotes.map((n) => ({
        at: n.wordIdx,
        item: {
          id: n.id,
          kind: 'note' as const,
          chapterTitle: chapterOf(n.wordIdx),
          body: n.content,
          context: textBetween(n.wordIdx - 4, n.wordIdx),
          color: undefined,
        },
      })),
    ]
      .sort((a, b) => a.at - b.at)
      .map((x) => x.item);

    groups.push({
      book,
      highlightCount: bookHighlights.length,
      noteCount: bookNotes.length,
      items,
    });
  }

  return groups.sort((a, b) => {
    if (a.book.id === currentBookId) return -1;
    if (b.book.id === currentBookId) return 1;
    return a.book.title.localeCompare(b.book.title);
  });
}

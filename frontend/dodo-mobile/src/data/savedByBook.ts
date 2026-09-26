import type { AskedQuestion, Book, Highlight, Note } from './mockBooks';

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

// Word text and chapter lookups for one book.
function bookText(book: Book) {
  const words = book.chapters.flatMap((c) => c.paragraphs.flatMap((p) => p.words));
  return {
    textBetween: (start: number, end: number) =>
      words
        .filter((w) => w.idx >= start && w.idx <= end)
        .map((w) => w.text)
        .join(' '),
    chapterOf: (idx: number) =>
      book.chapters.findLast((c) => (c.paragraphs[0]?.words[0]?.idx ?? Infinity) <= idx)?.title ??
      book.chapters[0]?.title ??
      '',
  };
}

// The book being read first, then the rest by title.
function byCurrentThenTitle<G extends { book: Book }>(groups: G[], currentBookId: string): G[] {
  return groups.sort((a, b) => {
    if (a.book.id === currentBookId) return -1;
    if (b.book.id === currentBookId) return 1;
    return a.book.title.localeCompare(b.book.title);
  });
}

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

    const { textBetween, chapterOf } = bookText(book);

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

  return byCurrentThenTitle(groups, currentBookId);
}

export type QuestionItem = {
  id: string;
  title: string;
  question: string;
  answer: string;
  chapterTitle: string;
  // The words just before where the question was asked.
  passage: string;
};

export type QuestionGroup = { book: Book; items: QuestionItem[] };

// Asked questions by book for the Notes "Ask DODO" tab: same book order as
// groupSavedByBook, newest question first within a book.
export function groupQuestionsByBook(
  books: Book[],
  asked: Saved<AskedQuestion>[],
  currentBookId: string,
): QuestionGroup[] {
  const groups: QuestionGroup[] = [];
  for (const book of books) {
    const mine = asked.filter((q) => q.bookId === book.id);
    if (mine.length === 0) continue;
    const { textBetween, chapterOf } = bookText(book);
    const items = [...mine]
      .sort((a, b) => b.askedAt.localeCompare(a.askedAt))
      .map((q) => ({
        id: q.id,
        title: q.title,
        question: q.question,
        answer: q.answer,
        chapterTitle: chapterOf(q.wordIdx),
        passage: textBetween(q.wordIdx - 4, q.wordIdx),
      }));
    groups.push({ book, items });
  }
  return byCurrentThenTitle(groups, currentBookId);
}

import type { Book, Chapter } from './mockBooks';

// Where the listener is in a book (lastIdx) and the furthest word they've
// reached (furthestIdx). Progress bars use the furthest point, so jumping back
// to re-listen doesn't erase progress.
export type Position = { lastIdx: number; furthestIdx: number };
export type Positions = Record<string, Position>;

const firstIdx = (c: Chapter) => c.paragraphs[0].words[0].idx;
const lastIdx = (c: Chapter) => {
  const last = c.paragraphs[c.paragraphs.length - 1];
  return last.words[last.words.length - 1].idx;
};
const share = (reached: number, first: number, last: number) =>
  Math.min(1, Math.max(0, (reached - first + 1) / (last - first + 1)));

// Share of each chapter read, 0 to 1.
export function chapterProgress(book: Book, furthestIdx: number): number[] {
  return book.chapters.map((c) => share(furthestIdx, firstIdx(c), lastIdx(c)));
}

// Share of the whole book read, 0 to 1.
export function bookProgress(book: Book, furthestIdx: number): number {
  const chapters = book.chapters;
  if (chapters.length === 0) return 0;
  return share(furthestIdx, firstIdx(chapters[0]), lastIdx(chapters[chapters.length - 1]));
}

// Index of the chapter containing a word.
export const chapterIndexAt = (book: Book, idx: number) =>
  Math.max(
    0,
    book.chapters.findLastIndex((c) => firstIdx(c) <= idx),
  );

export const chapterStart = (book: Book, chapterIdx: number) => firstIdx(book.chapters[chapterIdx]);

// ⏮ like a music player: past the chapter's first paragraph, back to its
// start; otherwise to the previous chapter.
export function previousChapterTarget(book: Book, idx: number): number {
  const at = chapterIndexAt(book, idx);
  const chapter = book.chapters[at];
  const firstParagraph = chapter.paragraphs[0];
  const firstParagraphEnd = firstParagraph.words[firstParagraph.words.length - 1].idx;
  if (idx > firstParagraphEnd || at === 0) return firstIdx(chapter);
  return firstIdx(book.chapters[at - 1]);
}

// ⏭: the start of the next chapter, or null in the last one.
export function nextChapterStart(book: Book, idx: number): number | null {
  const next = book.chapters[chapterIndexAt(book, idx) + 1];
  return next ? firstIdx(next) : null;
}

// Forgets one book's progress.
export function withoutBook(positions: Positions, bookId: string): Positions {
  return Object.fromEntries(Object.entries(positions).filter(([id]) => id !== bookId));
}

export function withPosition(current: Position | undefined, idx: number): Position {
  return { lastIdx: idx, furthestIdx: Math.max(current?.furthestIdx ?? -1, idx) };
}

const isPosition = (p: unknown): p is Position =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as Position).lastIdx === 'number' &&
  typeof (p as Position).furthestIdx === 'number';

// Reads the saved file's contents; a missing or corrupted file means no progress.
export function parsePositions(json: string | null): Positions {
  if (!json) return {};
  try {
    const raw: unknown = JSON.parse(json);
    if (typeof raw !== 'object' || raw === null) return {};
    return Object.fromEntries(Object.entries(raw).filter(([, p]) => isPosition(p))) as Positions;
  } catch {
    return {};
  }
}

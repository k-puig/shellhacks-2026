import type { Book } from '../mockBooks';
import {
  bookProgress,
  chapterProgress,
  nextChapterStart,
  parsePositions,
  previousChapterTarget,
  withoutBook,
  withPosition,
} from '../readingProgress';

// Three chapters of two paragraphs each; every paragraph has 5 words.
// Chapter 0: words 0-9, chapter 1: 10-19, chapter 2: 20-29.
function makeBook(): Book {
  let idx = 0;
  let paragraphIdx = 0;
  const para = () => ({
    paragraphIdx: paragraphIdx++,
    words: Array.from({ length: 5 }, () => ({ text: 'w', idx: idx++ })),
  });
  return {
    id: 'b',
    title: 'Book',
    author: 'A',
    coverColor: '#000',
    progress: 0,
    chapters: [0, 1, 2].map((chapterIdx) => ({
      chapterIdx,
      title: `Chapter ${chapterIdx + 1}`,
      paragraphs: [para(), para()],
    })),
  };
}
const book = makeBook();

describe('chapterProgress', () => {
  it('fills chapters up to the furthest word reached', () => {
    // Furthest word 14: chapter 0 done, chapter 1 half (words 10-14 of 10-19), chapter 2 untouched.
    expect(chapterProgress(book, 14)).toEqual([1, 0.5, 0]);
  });

  it('is empty before anything is read', () => {
    expect(chapterProgress(book, -1)).toEqual([0, 0, 0]);
  });

  it('is full at the last word', () => {
    expect(chapterProgress(book, 29)).toEqual([1, 1, 1]);
  });
});

describe('bookProgress', () => {
  it('is the share of words reached', () => {
    expect(bookProgress(book, 14)).toBe(0.5);
  });

  it('is 0 for a book never opened', () => {
    expect(bookProgress(book, -1)).toBe(0);
  });
});

describe('previousChapterTarget', () => {
  it('goes to the start of the current chapter once past its first paragraph', () => {
    expect(previousChapterTarget(book, 17)).toBe(10);
  });

  it('goes to the previous chapter from within the first paragraph', () => {
    expect(previousChapterTarget(book, 12)).toBe(0);
  });

  it('stays at the start of the first chapter', () => {
    expect(previousChapterTarget(book, 2)).toBe(0);
  });
});

describe('nextChapterStart', () => {
  it('is the start of the next chapter', () => {
    expect(nextChapterStart(book, 12)).toBe(20);
  });

  it('is null in the last chapter', () => {
    expect(nextChapterStart(book, 25)).toBeNull();
  });
});

describe('withPosition', () => {
  it('moves the current spot and extends the furthest point', () => {
    expect(withPosition(undefined, 7)).toEqual({ lastIdx: 7, furthestIdx: 7 });
    expect(withPosition({ lastIdx: 7, furthestIdx: 7 }, 12)).toEqual({ lastIdx: 12, furthestIdx: 12 });
  });

  it('keeps the furthest point when jumping back', () => {
    expect(withPosition({ lastIdx: 20, furthestIdx: 20 }, 3)).toEqual({ lastIdx: 3, furthestIdx: 20 });
  });
});

describe('parsePositions', () => {
  it('reads saved positions', () => {
    expect(parsePositions('{"b":{"lastIdx":3,"furthestIdx":9}}')).toEqual({
      b: { lastIdx: 3, furthestIdx: 9 },
    });
  });

  it('treats a missing file as no progress', () => {
    expect(parsePositions(null)).toEqual({});
  });

  it('ignores a corrupted file', () => {
    expect(parsePositions('{not json')).toEqual({});
  });

  it('drops entries that are not positions', () => {
    expect(parsePositions('{"a":{"lastIdx":"x"},"b":{"lastIdx":1,"furthestIdx":2}}')).toEqual({
      b: { lastIdx: 1, furthestIdx: 2 },
    });
  });
});

describe('withoutBook', () => {
  it('forgets one book and keeps the others', () => {
    const positions = { a: { lastIdx: 1, furthestIdx: 5 }, b: { lastIdx: 2, furthestIdx: 2 } };
    expect(withoutBook(positions, 'a')).toEqual({ b: { lastIdx: 2, furthestIdx: 2 } });
  });
});

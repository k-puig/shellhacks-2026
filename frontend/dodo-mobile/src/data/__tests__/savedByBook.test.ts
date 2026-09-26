import type { Book } from '../mockBooks';
import { groupQuestionsByBook, groupSavedByBook } from '../savedByBook';

// A two-chapter book whose words are "<prefix>0 <prefix>1 …", 5 words per chapter.
function makeBook(id: string, title: string): Book {
  const chapter = (chapterIdx: number) => ({
    chapterIdx,
    title: `Chapter ${chapterIdx + 1}`,
    paragraphs: [
      {
        paragraphIdx: chapterIdx,
        words: Array.from({ length: 5 }, (_, i) => {
          const idx = chapterIdx * 5 + i;
          return { text: `${id}${idx}`, idx };
        }),
      },
    ],
  });
  return { id, title, author: 'Author', coverColor: '#000', progress: 0, chapters: [chapter(0), chapter(1)] };
}

const alice = makeBook('a', "Alice's Adventures");
const moby = makeBook('m', 'Moby-Dick');
const pride = makeBook('p', 'Pride and Prejudice');
const books = [alice, moby, pride];

describe('groupSavedByBook', () => {
  it('puts the current book first, then the rest alphabetically, hiding empty books', () => {
    const groups = groupSavedByBook(
      books,
      [
        { id: 'h1', bookId: 'p', startIdx: 0, endIdx: 1, color: '#ff0' },
        { id: 'h2', bookId: 'a', startIdx: 0, endIdx: 1, color: '#ff0' },
      ],
      [{ id: 'n1', bookId: 'm', wordIdx: 2, content: 'whale!' }],
      'm',
    );
    expect(groups.map((g) => g.book.title)).toEqual([
      'Moby-Dick',
      "Alice's Adventures",
      'Pride and Prejudice',
    ]);
  });

  it('counts highlights and notes per book', () => {
    const [group] = groupSavedByBook(
      books,
      [
        { id: 'h1', bookId: 'a', startIdx: 0, endIdx: 1, color: '#ff0' },
        { id: 'h2', bookId: 'a', startIdx: 6, endIdx: 7, color: '#ff0' },
      ],
      [{ id: 'n1', bookId: 'a', wordIdx: 3, content: 'hmm' }],
      'a',
    );
    expect(group).toMatchObject({ highlightCount: 2, noteCount: 1 });
  });

  it('orders items by where they sit in the book and names their chapter', () => {
    const [group] = groupSavedByBook(
      books,
      [{ id: 'h1', bookId: 'a', startIdx: 6, endIdx: 7, color: '#0f0' }],
      [{ id: 'n1', bookId: 'a', wordIdx: 2, content: 'first thought' }],
      'a',
    );
    expect(group.items).toEqual([
      {
        id: 'n1',
        kind: 'note',
        chapterTitle: 'Chapter 1',
        body: 'first thought',
        context: 'a0 a1 a2',
        color: undefined,
      },
      {
        id: 'h1',
        kind: 'highlight',
        chapterTitle: 'Chapter 2',
        body: 'a6 a7',
        context: '',
        color: '#0f0',
      },
    ]);
  });

  it('skips items whose book is no longer in the library', () => {
    expect(
      groupSavedByBook(books, [{ id: 'h1', bookId: 'gone', startIdx: 0, endIdx: 1, color: '#ff0' }], [], 'a'),
    ).toEqual([]);
  });
});

describe('groupQuestionsByBook', () => {
  const asked = (id: string, bookId: string, wordIdx: number, askedAt: string) => ({
    id,
    bookId,
    wordIdx,
    question: `question ${id}`,
    answer: `answer ${id}`,
    title: `title ${id}`,
    askedAt,
  });

  it('puts the current book first, then the rest alphabetically, hiding empty books', () => {
    const groups = groupQuestionsByBook(
      books,
      [asked('q1', 'p', 0, '2026-09-26T10:00:00Z'), asked('q2', 'a', 0, '2026-09-26T10:00:00Z')],
      'p',
    );
    expect(groups.map((g) => g.book.title)).toEqual(['Pride and Prejudice', "Alice's Adventures"]);
  });

  it('lists the newest question first within a book, with its chapter and passage', () => {
    const [group] = groupQuestionsByBook(
      books,
      [asked('old', 'a', 2, '2026-09-26T10:00:00Z'), asked('new', 'a', 7, '2026-09-26T11:00:00Z')],
      'a',
    );
    expect(group.items).toEqual([
      {
        id: 'new',
        title: 'title new',
        question: 'question new',
        answer: 'answer new',
        chapterTitle: 'Chapter 2',
        passage: 'a3 a4 a5 a6 a7',
      },
      {
        id: 'old',
        title: 'title old',
        question: 'question old',
        answer: 'answer old',
        chapterTitle: 'Chapter 1',
        passage: 'a0 a1 a2',
      },
    ]);
  });
});

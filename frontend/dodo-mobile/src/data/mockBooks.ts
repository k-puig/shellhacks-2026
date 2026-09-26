// Mock data — delete once the epub-service returns real tokenized books.
// Shape follows the brief: word `idx` is global across the whole book.

export type Word = { text: string; idx: number };
export type Paragraph = { paragraphIdx: number; words: Word[] };
export type Chapter = { chapterIdx: number; title: string; paragraphs: Paragraph[] };
export type Book = {
  id: string;
  title: string;
  author: string;
  // Placeholder tint shown while the cover loads, or if there is none.
  coverColor: string;
  // Extracted from the EPUB by epub-service; optional because not every EPUB has one.
  coverUrl?: string;
  progress: number;
  chapters: Chapter[];
};

export type Highlight = { id: string; startIdx: number; endIdx: number; color: string };
export type Note = { id: string; wordIdx: number; content: string };

// A question the listener asked DODO about the book, with its spoken answer.
export type AskedQuestion = {
  id: string;
  wordIdx: number;
  question: string;
  answer: string;
  // Short label for the Notes tab, e.g. "Why the Rabbit is late".
  title: string;
  // ISO timestamp.
  askedAt: string;
};

function tokenize(
  meta: Omit<Book, 'chapters'>,
  raw: { title: string; paragraphs: string[] }[],
): Book {
  let idx = 0;
  let paragraphIdx = 0;
  return {
    ...meta,
    chapters: raw.map((chapter, chapterIdx) => ({
      chapterIdx,
      title: chapter.title,
      paragraphs: chapter.paragraphs.map((text) => ({
        paragraphIdx: paragraphIdx++,
        words: text.split(/\s+/).filter(Boolean).map((w) => ({ text: w, idx: idx++ })),
      })),
    })),
  };
}

// Covers from the Project Gutenberg EPUBs of the same books.
const gutenbergCover = (id: number) =>
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;

// All excerpts are public domain.
const sampleBooks: Book[] = [
  tokenize({ id: 'alice', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', coverColor: '#6B4E8C', coverUrl: gutenbergCover(11), progress: 0.12 }, [
    {
      title: 'Chapter I: Down the Rabbit-Hole',
      paragraphs: [
        'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do. Once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it. "And what is the use of a book," thought Alice, "without pictures or conversations?"',
        'So she was considering in her own mind, as well as she could, for the hot day made her feel very sleepy and stupid, whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.',
        'There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, "Oh dear! Oh dear! I shall be late!" But when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet.',
        'Burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge. In another moment down went Alice after it, never once considering how in the world she was to get out again.',
      ],
    },
    {
      title: 'Chapter II: The Pool of Tears',
      paragraphs: [
        '"Curiouser and curiouser!" cried Alice. She was so much surprised that for the moment she quite forgot how to speak good English. "Now I am opening out like the largest telescope that ever was! Good-bye, feet!"',
        'Just then her head struck against the roof of the hall. In fact she was now more than nine feet high, and she at once took up the little golden key and hurried off to the garden door.',
      ],
    },
  ]),
  tokenize({ id: 'pride', title: 'Pride and Prejudice', author: 'Jane Austen', coverColor: '#3E6B5C', coverUrl: gutenbergCover(1342), progress: 0.46 }, [
    {
      title: 'Chapter 1',
      paragraphs: [
        'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
        'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
        '"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?" Mr. Bennet replied that he had not.',
      ],
    },
  ]),
  tokenize({ id: 'moby', title: 'Moby-Dick', author: 'Herman Melville', coverColor: '#2F4A6D', coverUrl: gutenbergCover(2701), progress: 0.03 }, [
    {
      title: 'Chapter 1: Loomings',
      paragraphs: [
        'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.',
        'It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; then, I account it high time to get to sea as soon as I can.',
      ],
    },
  ]),
  tokenize({ id: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley', coverColor: '#7A3B3B', coverUrl: gutenbergCover(84), progress: 0.71 }, [
    {
      title: 'Letter 1',
      paragraphs: [
        'You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.',
        'I am already far north of London, and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves and fills me with delight.',
      ],
    },
  ]),
];

// A full-length test book converted locally from an EPUB with
// scripts/epub_to_book.py. It's git-ignored (copyrighted), so this require is
// optional: without the file, the sample books above are used.
function loadTestBook(): Book | null {
  try {
    return require('./generated/testBook.json') as Book;
  } catch {
    return null;
  }
}

const testBook = loadTestBook();

// The library: the local test book when present, instead of the samples.
export const mockBooks: Book[] = testBook ? [testBook] : sampleBooks;

export function getBook(id: string | undefined): Book {
  return mockBooks.find((b) => b.id === id) ?? mockBooks[0];
}

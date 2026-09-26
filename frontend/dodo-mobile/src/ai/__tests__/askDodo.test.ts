import type { Book } from '@/data/mockBooks';
import { splitSentences } from '@/voice/geminiInterpreter';

import { bookSoFar, parseAnswer, READER_MARKER, resumePoint } from '../askDodo';

// Chapter 1: "Alice was bored. She sat still."  (idx 0-5)
// Chapter 2: "A rabbit ran by. It had a watch." (idx 6-13)
function makeBook(): Book {
  let idx = 0;
  const para = (paragraphIdx: number, text: string) => ({
    paragraphIdx,
    words: text.split(' ').map((w) => ({ text: w, idx: idx++ })),
  });
  return {
    id: 'alice',
    title: 'Alice',
    author: 'Lewis Carroll',
    coverColor: '#000',
    progress: 0,
    chapters: [
      { chapterIdx: 0, title: 'Chapter 1', paragraphs: [para(0, 'Alice was bored. She sat still.')] },
      { chapterIdx: 1, title: 'Chapter 2', paragraphs: [para(1, 'A rabbit ran by. It had a watch.')] },
    ],
  };
}

const book = makeBook();
const sentences = splitSentences(book.chapters.flatMap((c) => c.paragraphs));

describe('bookSoFar', () => {
  it('includes everything up to the end of the current sentence, with chapter headings', () => {
    const text = bookSoFar(book, 8); // "ran"
    expect(text).toBe(
      `## Chapter 1\n\nAlice was bored. She sat still.\n\n## Chapter 2\n\nA rabbit ran by.\n\n${READER_MARKER}`,
    );
  });

  it('never includes what comes after the reader', () => {
    expect(bookSoFar(book, 8)).not.toContain('watch');
  });

  it('keeps only the most recent text when the book is too long, still ending with the marker', () => {
    const text = bookSoFar(book, 13, 20);
    expect(text.endsWith(READER_MARKER)).toBe(true);
    expect(text).not.toContain('Alice');
    expect(text).toContain('It had a watch.');
  });
});

describe('resumePoint', () => {
  it('is the start of the sentence being read', () => {
    expect(resumePoint(sentences, 11)).toBe(10); // "had" in "It had a watch." → "It"
  });

  it('works for the first sentence of a chapter', () => {
    expect(resumePoint(sentences, 7)).toBe(6);
  });
});

describe('parseAnswer', () => {
  it('rejects an empty answer', () => {
    expect(() => parseAnswer({ answer: '  ', title: 'x' }, 'why?')).toThrow();
  });

  it('falls back to the first six words of the question for a missing title', () => {
    expect(parseAnswer({ answer: 'Because.' }, 'why is the white rabbit always so late')).toEqual({
      answer: 'Because.',
      title: 'why is the white rabbit always',
    });
  });

  it('trims what Gemini returned', () => {
    expect(parseAnswer({ answer: ' She is bored. ', title: ' Why Alice is bored ' }, 'q')).toEqual({
      answer: 'She is bored.',
      title: 'Why Alice is bored',
    });
  });
});

describe('answerQuestion', () => {
  it('only sends Gemini the book up to where the reader is', async () => {
    process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'test-key';
    const fetchMock = jest.fn(async (_url: string, _init: { body: string }) => ({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: JSON.stringify({ answer: 'It is late.', title: 'The late rabbit' }) }] } },
        ],
      }),
    }));
    globalThis.fetch = fetchMock as never;
    let answerQuestion!: typeof import('../askDodo').answerQuestion;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      answerQuestion = require('../askDodo').answerQuestion;
    });

    const result = await answerQuestion('why is the rabbit late?', book, 8);

    expect(result).toEqual({ answer: 'It is late.', title: 'The late rabbit' });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text as string;
    expect(sent).toContain('A rabbit ran by.');
    expect(sent).toContain(READER_MARKER);
    expect(sent).not.toContain('watch');
  });
});

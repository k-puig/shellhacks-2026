import type { Book } from '@/data/mockBooks';
import { splitSentences, type Sentence } from '@/voice/geminiInterpreter';

import { generateJson } from './gemini';

// Answers a listener's question about the book, using only what they've read
// so far: the text sent stops at their current sentence, so it can't spoil.

export const READER_MARKER = '[The reader is here.]';
// About 100k tokens: plenty for a long novel, and keeps answers quick.
const MAX_CONTEXT_CHARS = 400_000;
const TIMEOUT_MS = 12_000;
const TITLE_WORDS = 6;

const SYSTEM_PROMPT = `You are DODO, the voice assistant inside an audiobook app. The listener just asked a question about the book they're hearing.

You get their question (an English speech transcript, so expect small mishearings) and the book's text from the beginning up to where they are, which ends with "${READER_MARKER}".

Answer so they understand what they're reading:
- 2 to 4 short sentences, written to be spoken aloud: plain words, no lists, no markdown.
- Connect it to earlier events, characters or themes in the text when that helps.
- Explain the meaning of words or phrases in context when asked.
- Never mention, hint at or guess what happens after "${READER_MARKER}". If they ask about the future, say you'll find out together as the story goes on.
- If the question isn't about the book, answer briefly and kindly.

Also set title: a label of at most 6 words for their notes, e.g. "Why the Rabbit is late".`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    title: { type: 'STRING' },
  },
  required: ['answer', 'title'],
};

// The book from the start through the end of the sentence containing
// currentIdx, with chapter headings, keeping the most recent maxChars.
export function bookSoFar(book: Book, currentIdx: number, maxChars = MAX_CONTEXT_CHARS): string {
  const sentences = splitSentences(book.chapters.flatMap((c) => c.paragraphs));
  const current = sentences.find((s) => currentIdx >= s.startIdx && currentIdx <= s.endIdx);
  const endIdx = current?.endIdx ?? currentIdx;

  const parts: string[] = [];
  for (const chapter of book.chapters) {
    if ((chapter.paragraphs[0]?.words[0]?.idx ?? Infinity) > endIdx) break;
    parts.push(`## ${chapter.title}`);
    for (const paragraph of chapter.paragraphs) {
      const words = paragraph.words.filter((w) => w.idx <= endIdx);
      if (words.length === 0) break;
      parts.push(words.map((w) => w.text).join(' '));
    }
  }

  let text = parts.join('\n\n');
  if (text.length > maxChars) {
    text = text.slice(text.length - maxChars);
    // Don't start in the middle of a word.
    text = text.slice(text.search(/\s/) + 1).trimStart();
  }
  return `${text}\n\n${READER_MARKER}`;
}

// Where narration picks back up after an answer: the start of the sentence
// that was being read when the listener asked.
export function resumePoint(sentences: Sentence[], idx: number): number {
  return sentences.find((s) => idx >= s.startIdx && idx <= s.endIdx)?.startIdx ?? idx;
}

export function parseAnswer(
  raw: { answer?: unknown; title?: unknown },
  question: string,
): { answer: string; title: string } {
  const answer = typeof raw.answer === 'string' ? raw.answer.trim() : '';
  if (!answer) throw new Error('Gemini returned an empty answer');
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : question.trim().split(/\s+/).slice(0, TITLE_WORDS).join(' ');
  return { answer, title };
}

export async function answerQuestion(
  question: string,
  book: Book,
  currentIdx: number,
): Promise<{ answer: string; title: string }> {
  const raw = await generateJson<{ answer?: unknown; title?: unknown }>({
    system: SYSTEM_PROMPT,
    user: JSON.stringify({ question, book: bookSoFar(book, currentIdx) }),
    schema: RESPONSE_SCHEMA,
    timeoutMs: TIMEOUT_MS,
  });
  return parseAnswer(raw, question);
}

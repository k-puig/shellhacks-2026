import type { AskedQuestion, Highlight, Note } from './mockBooks';

export type Saved<T> = T & { bookId: string };

// Everything the listener saved while reading, kept on the phone so it
// survives closing the app. (Moves to the backend with accounts.)
export type SavedItems = {
  highlights: Saved<Highlight>[];
  notes: Saved<Note>[];
  askedQuestions: Saved<AskedQuestion>[];
};

export const emptySavedItems = (): SavedItems => ({ highlights: [], notes: [], askedQuestions: [] });

type Fields = Record<string, 'string' | 'number'>;

const hasFields = (item: unknown, fields: Fields): boolean =>
  typeof item === 'object' &&
  item !== null &&
  Object.entries(fields).every(([key, type]) => typeof (item as Record<string, unknown>)[key] === type);

const HIGHLIGHT: Fields = { id: 'string', bookId: 'string', startIdx: 'number', endIdx: 'number', color: 'string' };
const NOTE: Fields = { id: 'string', bookId: 'string', wordIdx: 'number', content: 'string' };
const QUESTION: Fields = {
  id: 'string',
  bookId: 'string',
  wordIdx: 'number',
  question: 'string',
  answer: 'string',
  title: 'string',
  askedAt: 'string',
};

// Keeps the entries of a saved list that have every field; drops the rest.
function validList<T>(list: unknown, fields: Fields): T[] {
  return Array.isArray(list) ? (list.filter((item) => hasFields(item, fields)) as T[]) : [];
}

// Reads the saved file's contents; a missing or corrupted file means nothing
// saved, and a malformed entry is skipped instead of losing the rest.
export function parseSavedItems(json: string | null): SavedItems {
  if (!json) return emptySavedItems();
  try {
    const raw: unknown = JSON.parse(json);
    if (typeof raw !== 'object' || raw === null) return emptySavedItems();
    const { highlights, notes, askedQuestions } = raw as Record<string, unknown>;
    return {
      highlights: validList(highlights, HIGHLIGHT),
      notes: validList(notes, NOTE),
      askedQuestions: validList(askedQuestions, QUESTION),
    };
  } catch {
    return emptySavedItems();
  }
}

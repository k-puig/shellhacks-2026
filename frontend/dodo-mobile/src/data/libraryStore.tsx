import { createContext, useContext, useState, type PropsWithChildren } from 'react';

import type { AskedQuestion, Highlight, Note } from './mockBooks';

type Saved<T> = T & { bookId: string };

type LibraryState = {
  currentBookId: string;
  openBook: (bookId: string) => void;
  highlights: Saved<Highlight>[];
  notes: Saved<Note>[];
  addHighlight: (h: Omit<Saved<Highlight>, 'id'>) => void;
  addNote: (n: Omit<Saved<Note>, 'id'>) => void;
  removeHighlight: (id: string) => void;
  recolorHighlight: (id: string, color: string) => void;
  removeNote: (id: string) => void;
  askedQuestions: Saved<AskedQuestion>[];
  addAskedQuestion: (q: Omit<Saved<AskedQuestion>, 'id'>) => void;
  removeAskedQuestion: (id: string) => void;
};

const LibraryContext = createContext<LibraryState | null>(null);

let nextId = 0;
const newId = (prefix: string) => `${prefix}${Date.now()}-${nextId++}`;

// In-memory for the MVP; swap for TanStack Query + the backend later.
export function LibraryProvider({ children }: PropsWithChildren) {
  const [currentBookId, openBook] = useState('alice');
  const [highlights, setHighlights] = useState<Saved<Highlight>[]>([]);
  const [notes, setNotes] = useState<Saved<Note>[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<Saved<AskedQuestion>[]>([]);

  return (
    <LibraryContext.Provider
      value={{
        currentBookId,
        openBook,
        highlights,
        notes,
        addHighlight: (h) => setHighlights((all) => [...all, { ...h, id: newId('h') }]),
        addNote: (n) => setNotes((all) => [...all, { ...n, id: newId('n') }]),
        removeHighlight: (id) => setHighlights((all) => all.filter((h) => h.id !== id)),
        recolorHighlight: (id, color) =>
          setHighlights((all) => all.map((h) => (h.id === id ? { ...h, color } : h))),
        removeNote: (id) => setNotes((all) => all.filter((n) => n.id !== id)),
        askedQuestions,
        addAskedQuestion: (q) => setAskedQuestions((all) => [...all, { ...q, id: newId('q') }]),
        removeAskedQuestion: (id) => setAskedQuestions((all) => all.filter((q) => q.id !== id)),
      }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used inside LibraryProvider');
  return value;
}

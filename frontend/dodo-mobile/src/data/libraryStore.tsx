import { createContext, useContext, useState, type PropsWithChildren } from 'react';

import type { Highlight, Note } from './mockBooks';

type Saved<T> = T & { bookId: string };

type LibraryState = {
  currentBookId: string;
  openBook: (bookId: string) => void;
  highlights: Saved<Highlight>[];
  notes: Saved<Note>[];
  addHighlight: (h: Omit<Saved<Highlight>, 'id'>) => void;
  addNote: (n: Omit<Saved<Note>, 'id'>) => void;
  removeHighlight: (id: string) => void;
  removeNote: (id: string) => void;
};

const LibraryContext = createContext<LibraryState | null>(null);

let nextId = 0;
const newId = (prefix: string) => `${prefix}${Date.now()}-${nextId++}`;

// In-memory for the MVP; swap for TanStack Query + the backend later.
export function LibraryProvider({ children }: PropsWithChildren) {
  const [currentBookId, openBook] = useState('alice');
  const [highlights, setHighlights] = useState<Saved<Highlight>[]>([]);
  const [notes, setNotes] = useState<Saved<Note>[]>([]);

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
        removeNote: (id) => setNotes((all) => all.filter((n) => n.id !== id)),
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

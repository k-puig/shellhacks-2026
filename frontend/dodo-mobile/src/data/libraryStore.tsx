import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { mockBooks, type AskedQuestion, type Highlight, type Note } from './mockBooks';
import { loadPositions, savePositions } from './progressFile';
import { withoutBook, withPosition, type Positions } from './readingProgress';

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
  // Where the listener is in each book, and the furthest point reached.
  positions: Positions;
  // False until saved positions have been read at launch.
  positionsLoaded: boolean;
  setPosition: (bookId: string, idx: number) => void;
  clearPosition: (bookId: string) => void;
  // Settings → Your data.
  clearHighlightsAndNotes: () => void;
  clearAskedQuestions: () => void;
  clearAllPositions: () => void;
};

const LibraryContext = createContext<LibraryState | null>(null);

let nextId = 0;
const newId = (prefix: string) => `${prefix}${Date.now()}-${nextId++}`;

// In-memory for the MVP; swap for TanStack Query + the backend later.
export function LibraryProvider({ children }: PropsWithChildren) {
  const [currentBookId, openBook] = useState(mockBooks[0].id);
  const [highlights, setHighlights] = useState<Saved<Highlight>[]>([]);
  const [notes, setNotes] = useState<Saved<Note>[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<Saved<AskedQuestion>[]>([]);
  const [positions, setPositions] = useState<Positions>({});
  const [positionsLoaded, setPositionsLoaded] = useState(false);

  useEffect(() => {
    loadPositions().then((saved) => {
      setPositions(saved);
      setPositionsLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (positionsLoaded) savePositions(positions);
  }, [positions, positionsLoaded]);

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
        positions,
        positionsLoaded,
        setPosition: (bookId, idx) =>
          setPositions((all) => ({ ...all, [bookId]: withPosition(all[bookId], idx) })),
        clearPosition: (bookId) => setPositions((all) => withoutBook(all, bookId)),
        clearHighlightsAndNotes: () => {
          setHighlights([]);
          setNotes([]);
        },
        clearAskedQuestions: () => setAskedQuestions([]),
        clearAllPositions: () => setPositions({}),
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

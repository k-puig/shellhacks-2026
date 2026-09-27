import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { loadImportedBooks, saveImportedBook } from './bookFiles';
import type { EpubCover } from './epub';
import { buildLibrary, isSameBook } from './library';
import { mockBooks, type AskedQuestion, type Book, type Highlight, type Note } from './mockBooks';
import { loadPositions, savePositions } from './progressFile';
import { withoutBook, withPosition, type Positions } from './readingProgress';
import { loadSavedItems, saveSavedItems } from './savedFile';
import { mergeById, type Saved } from './savedItems';

type LibraryState = {
  // Added books first (newest first), then the built-in samples.
  books: Book[];
  getBook: (id: string | undefined) => Book;
  // Saves a converted book on the phone and puts it in the library. Returns
  // the copy already there instead if the listener added this book before.
  addBook: (book: Book, cover: EpubCover | null) => Book;
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

// Saved on the phone for now; swap for TanStack Query + the backend later.
export function LibraryProvider({ children }: PropsWithChildren) {
  const [importedBooks, setImportedBooks] = useState<Book[]>([]);
  const [currentBookId, openBook] = useState(mockBooks[0].id);
  const [highlights, setHighlights] = useState<Saved<Highlight>[]>([]);
  const [notes, setNotes] = useState<Saved<Note>[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<Saved<AskedQuestion>[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [positions, setPositions] = useState<Positions>({});
  const [positionsLoaded, setPositionsLoaded] = useState(false);

  useEffect(() => {
    loadImportedBooks().then((saved) => setImportedBooks((added) => buildLibrary(added, saved)));
  }, []);
  const books = useMemo(() => buildLibrary(importedBooks, mockBooks), [importedBooks]);
  const getBook = useCallback(
    (id: string | undefined) => books.find((b) => b.id === id) ?? books[0],
    [books],
  );

  useEffect(() => {
    loadPositions().then((saved) => {
      setPositions(saved);
      setPositionsLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (positionsLoaded) savePositions(positions);
  }, [positions, positionsLoaded]);

  // Saved items go first; anything added while the file was loading stays.
  // Merged by id: in development, a hot reload re-runs this with the items
  // already in memory, which must not duplicate them.
  useEffect(() => {
    loadSavedItems().then((saved) => {
      setHighlights((added) => mergeById(saved.highlights, added));
      setNotes((added) => mergeById(saved.notes, added));
      setAskedQuestions((added) => mergeById(saved.askedQuestions, added));
      setSavedLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (savedLoaded) saveSavedItems({ highlights, notes, askedQuestions });
  }, [highlights, notes, askedQuestions, savedLoaded]);

  return (
    <LibraryContext.Provider
      value={{
        books,
        getBook,
        addBook: (book, cover) => {
          const existing = importedBooks.find((b) => isSameBook(b, book));
          if (existing) return existing;
          const saved = saveImportedBook(book, cover);
          setImportedBooks((all) => [saved, ...all]);
          return saved;
        },
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

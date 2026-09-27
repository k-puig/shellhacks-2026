import type { Book } from './mockBooks';

// The library: every converted book first (newest additions are whatever the
// converter listed), then the sample books. A book id appears only once.
export function buildLibrary(converted: Book[], samples: Book[]): Book[] {
  const seen = new Set<string>();
  return [...converted, ...samples].filter((book) => {
    if (seen.has(book.id)) return false;
    seen.add(book.id);
    return true;
  });
}

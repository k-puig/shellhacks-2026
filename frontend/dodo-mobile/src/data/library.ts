import type { Book } from './mockBooks';

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const lastName = (author: string) => normalize(author).split(' ').pop() ?? '';

// Two copies of the same book: same author's last name, and one title is the
// other or starts it ("Frankenstein" / "Frankenstein; or, the Modern Prometheus").
export function isSameBook(a: Book, b: Book): boolean {
  if (a.id === b.id) return true;
  if (lastName(a.author) !== lastName(b.author)) return false;
  const [short, long] = [normalize(a.title), normalize(b.title)].sort((x, y) => x.length - y.length);
  return short.length > 0 && (long === short || long.startsWith(`${short} `));
}

// The library: every converted book first (newest additions are whatever the
// converter listed), then the sample books. A book appears only once: a full
// copy the listener added hides the sample of the same book, and borrows the
// sample's cover if its EPUB had none.
export function buildLibrary(converted: Book[], samples: Book[]): Book[] {
  const kept: Book[] = [];
  for (const book of [...converted, ...samples]) {
    const at = kept.findIndex((k) => isSameBook(k, book));
    if (at === -1) kept.push(book);
    else if (!kept[at].coverUrl && book.coverUrl) kept[at] = { ...kept[at], coverUrl: book.coverUrl };
  }
  return kept;
}

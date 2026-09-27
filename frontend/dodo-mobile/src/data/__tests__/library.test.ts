import type { Book } from '../mockBooks';
import { buildLibrary, isSameBook } from '../library';

const book = (id: string, title = id, author = 'A'): Book => ({
  id,
  title,
  author,
  coverColor: '#000',
  progress: 0,
  chapters: [],
});

describe('buildLibrary', () => {
  it('lists converted books first, then the samples', () => {
    expect(buildLibrary([book('grokking')], [book('alice'), book('moby')]).map((b) => b.id)).toEqual([
      'grokking',
      'alice',
      'moby',
    ]);
  });

  it('holds any number of books', () => {
    const converted = Array.from({ length: 12 }, (_, i) => book(`b${i}`));
    expect(buildLibrary(converted, [book('alice')])).toHaveLength(13);
  });

  it('keeps only the first book with a given id', () => {
    expect(buildLibrary([book('alice', 'Converted Alice')], [book('alice', 'Sample Alice')])).toEqual([
      book('alice', 'Converted Alice'),
    ]);
  });

  it('is just the samples when nothing has been converted', () => {
    expect(buildLibrary([], [book('alice')]).map((b) => b.id)).toEqual(['alice']);
  });

  it('hides a sample once the full book has been added', () => {
    const added = book('uuid-1', 'Alice’s Adventures in Wonderland', 'Lewis Carroll');
    const sample = book('alice', "Alice's Adventures in Wonderland", 'Lewis Carroll');
    expect(buildLibrary([added], [sample, book('moby')]).map((b) => b.id)).toEqual(['uuid-1', 'moby']);
  });

  it("borrows the hidden sample's cover when the added copy has none", () => {
    const added = book('uuid-1', 'Moby-Dick', 'Herman Melville');
    const sample = { ...book('moby', 'Moby-Dick', 'Herman Melville'), coverUrl: 'https://covers/moby.jpg' };
    expect(buildLibrary([added], [sample])).toEqual([{ ...added, coverUrl: 'https://covers/moby.jpg' }]);
    // Its own cover wins.
    const withCover = { ...added, coverUrl: 'file:///books/uuid-1-cover.jpg' };
    expect(buildLibrary([withCover], [sample])[0].coverUrl).toBe('file:///books/uuid-1-cover.jpg');
  });
});

describe('isSameBook', () => {
  it('matches a longer edition title by the same author', () => {
    expect(
      isSameBook(
        book('a', 'Frankenstein', 'Mary Shelley'),
        book('b', 'Frankenstein; or, the modern prometheus', 'Mary Wollstonecraft Shelley'),
      ),
    ).toBe(true);
  });

  it('tells different books apart', () => {
    expect(isSameBook(book('a', 'Emma', 'Jane Austen'), book('b', 'Emma', 'Someone Else'))).toBe(false);
    expect(isSameBook(book('a', 'Moby', 'H M'), book('b', 'Mobydick', 'H M'))).toBe(false);
  });
});

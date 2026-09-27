import type { Book } from '../mockBooks';
import { buildLibrary } from '../library';

const book = (id: string, title = id): Book => ({
  id,
  title,
  author: 'A',
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
});

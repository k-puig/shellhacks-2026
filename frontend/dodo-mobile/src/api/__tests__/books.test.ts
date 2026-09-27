import type { Book } from '@/data/mockBooks';

import { uploadBook } from '../books';

const book: Book = {
  id: '6f1c2b1e-5c1a-4b7e-9d2a-1c3e5f7a9b0d',
  title: 'Frankenstein',
  author: 'Mary Shelley',
  coverColor: '#000',
  progress: 0,
  chapters: [],
};

describe('uploadBook', () => {
  it('posts the .epub with the book id, title and author as a form', async () => {
    const api = jest.fn(async () => ({ id: book.id }));

    await uploadBook(api as never, book, 'file:///cache/frankenstein.epub');

    const [path, init] = api.mock.calls[0] as unknown as [string, { method: string; body: FormData }];
    expect(path).toBe('/book');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get('id')).toBe(book.id);
    expect(init.body.get('title')).toBe('Frankenstein');
    expect(init.body.get('author')).toBe('Mary Shelley');
    expect(init.body.has('book')).toBe(true);
  });
});

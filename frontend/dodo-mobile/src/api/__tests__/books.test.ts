import type { Book } from '@/data/mockBooks';

import { listBooks, updateBookProgress, uploadBook } from '../books';

// expo-file-system's File is native; in tests a Blob stands in for the picked file.
jest.mock('expo-file-system', () => ({
  File: function MockFile() {
    return new Blob(['epub bytes'], { type: 'application/epub+zip' });
  },
}));

const book: Book = {
  id: '6f1c2b1e-5c1a-4b7e-9d2a-1c3e5f7a9b0d',
  title: 'Frankenstein',
  author: 'Mary Shelley',
  coverColor: '#000',
  progress: 0,
  chapters: [],
};

describe('uploadBook', () => {
  it('posts the .epub without a local id and returns the server-assigned id', async () => {
    const remote = { id: 'remote-id' };
    const api = jest.fn(async () => remote);

    await expect(uploadBook(api as never, book, 'file:///cache/frankenstein.epub')).resolves.toBe(remote);

    const [path, init] = api.mock.calls[0] as unknown as [string, { method: string; body: FormData }];
    expect(path).toBe('/book');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.has('id')).toBe(false);
    expect(init.body.has('libraryId')).toBe(false);
    expect(init.body.get('title')).toBe('Frankenstein');
    expect(init.body.get('author')).toBe('Mary Shelley');
    expect(init.body.has('book')).toBe(true);
  });

  it('includes only an explicitly chosen libraryId', async () => {
    const api = jest.fn(async (_path: string, _init?: { body?: FormData }) => ({ id: 'remote-id' }));
    await uploadBook(api as never, book, 'file:///cache/book.epub', 'owned-library-id');
    expect(api.mock.calls[0][1]?.body?.get('libraryId')).toBe('owned-library-id');
  });

  it('lists account books', async () => {
    const api = jest.fn(async () => [{ id: 'remote-id' }]);
    await expect(listBooks(api as never)).resolves.toEqual([{ id: 'remote-id' }]);
    expect(api).toHaveBeenCalledWith('/book');
  });

  it('PATCHes the backend book ID with a word index, not local progress percentage', async () => {
    const api = jest.fn(async () => ({ id: 'server-id', progress: 47 }));
    await expect(updateBookProgress(api as never, 'server-id', 47)).resolves.toEqual({ id: 'server-id', progress: 47 });
    expect(api).toHaveBeenCalledWith('/book/server-id/progress', {
      method: 'PATCH',
      body: { position: 47 },
    });
  });
});

describe('uploadBook file part', () => {
  it('attaches the picked file as a real file named <id>.epub (not a { uri } object)', async () => {
    const api = jest.fn(async (_path: string, _init?: { body?: FormData }) => ({ id: 'remote-id' }));
    await uploadBook(api as never, book, 'file:///cache/frankenstein.epub');
    const part = api.mock.calls[0][1]?.body?.get('book') as File;
    expect(part).toBeInstanceOf(Blob);
    expect(part.name).toBe(`${book.id}.epub`);
  });
});

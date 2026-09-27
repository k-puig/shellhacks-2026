import type { Book } from '@/data/mockBooks';

import type { ApiClient } from './client';

// Book routes of the backend (backend/app/rest/book). The backend keeps the
// .epub in S3 under the same id the phone gave the book.

export type RemoteBook = {
  id: string;
  libraryId: string | null;
  title: string;
  author: string;
  s3Key: string;
  lastAccessedAt: string | null;
  // The word index the reader was on.
  progress: number | null;
};

// Uploads an added book's .epub (fileUri: the picked file on the phone).
export async function uploadBook(api: ApiClient, book: Book, fileUri: string): Promise<RemoteBook> {
  const form = new FormData();
  form.append('id', book.id);
  form.append('title', book.title);
  form.append('author', book.author);
  // React Native uploads a local file given its uri, name and type.
  form.append('book', { uri: fileUri, name: `${book.id}.epub`, type: 'application/epub+zip' } as unknown as Blob);
  return await api<RemoteBook>('/book', { method: 'POST', body: form });
}

import { File } from 'expo-file-system';

import type { Book } from '@/data/mockBooks';

import type { ApiClient } from './client';

// The backend owns account book IDs; the phone keeps its own offline IDs.

export type RemoteBook = {
  id: string;
  libraryId: string | null;
  userId: string;
  title: string;
  author: string;
  s3Key: string;
  lastAccessedAt: string | null;
  // The word index the reader was on.
  progress: number | null;
};

export const listBooks = (api: ApiClient) => api<RemoteBook[]>('/book');

// The backend accepts the listener's current word index, not a percentage.
export const updateBookProgress = (api: ApiClient, remoteId: string, position: number) =>
  api<RemoteBook>(`/book/${encodeURIComponent(remoteId)}/progress`, {
    method: 'PATCH',
    body: { position },
  });

// Uploads an added book's .epub (fileUri: the picked file on the phone).
export async function uploadBook(api: ApiClient, book: Book, fileUri: string, libraryId?: string): Promise<RemoteBook> {
  const form = new FormData();
  if (libraryId) form.append('libraryId', libraryId);
  form.append('title', book.title);
  form.append('author', book.author);
  // Expo's fetch (SDK 57) uploads real file objects only; the old React Native
  // { uri, name, type } part fails with "Unsupported FormDataPart implementation".
  // expo-file-system's File is a Blob pointing at the picked file on the phone.
  form.append('book', new File(fileUri), `${book.id}.epub`);
  return await api<RemoteBook>('/book', { method: 'POST', body: form });
}

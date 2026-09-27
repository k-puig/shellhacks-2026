import { uploadBook, type RemoteBook } from '@/api/books';
import type { ApiClient } from '@/api/client';

import type { Book } from './mockBooks';
import { loadRemoteBookIds, saveRemoteBookId } from './remoteBookIds';

// A reimport supplies a fresh cache URI even when the local book already exists.
// Only upload when this account has no remote ID for that local copy.
export async function syncImportedBook(
  api: ApiClient,
  subject: string,
  book: Book,
  fileUri: string,
): Promise<{ status: 'already-synced' } | { status: 'uploaded'; remote: RemoteBook }> {
  const ids = await loadRemoteBookIds(subject);
  if (ids[book.id]) return { status: 'already-synced' };

  const remote = await uploadBook(api, book, fileUri);
  if (!remote.id) throw new Error('The server did not return a book ID.');
  await saveRemoteBookId(subject, book.id, remote.id);
  return { status: 'uploaded', remote };
}

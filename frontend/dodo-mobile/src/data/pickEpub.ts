import { randomUUID } from 'expo-crypto';
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';

import { convertEpub, type EpubCover } from './epub';
import type { Book } from './mockBooks';

// Lets the listener pick an .epub (Files, iCloud Drive, AirDrop…) and turns it
// into a Book and its cover. Null if they cancel; throws EpubError for files
// that can't be read. The UUID is local only; the backend assigns its own id.
// fileUri (the picked file, copied to the app's cache) is what gets uploaded.
export async function pickEpubBook(): Promise<{
  book: Book;
  cover: EpubCover | null;
  fileUri: string;
} | null> {
  const result = await getDocumentAsync({
    type: ['application/epub+zip', 'org.idpf.epub-container'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const fileUri = result.assets[0].uri;
  const bytes = new Uint8Array(await new File(fileUri).arrayBuffer());
  return { ...convertEpub(bytes, randomUUID()), fileUri };
}

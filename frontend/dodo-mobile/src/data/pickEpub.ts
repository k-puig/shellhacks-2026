import { randomUUID } from 'expo-crypto';
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';

import { convertEpub, type EpubCover } from './epub';
import type { Book } from './mockBooks';

// Lets the listener pick an .epub (Files, iCloud Drive, AirDrop…) and turns it
// into a Book and its cover. Null if they cancel; throws EpubError for files
// that can't be read. The UUID doubles as the backend book id once uploads land.
export async function pickEpubBook(): Promise<{ book: Book; cover: EpubCover | null } | null> {
  const result = await getDocumentAsync({
    type: ['application/epub+zip', 'org.idpf.epub-container'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const bytes = new Uint8Array(await new File(result.assets[0].uri).arrayBuffer());
  return convertEpub(bytes, randomUUID());
}

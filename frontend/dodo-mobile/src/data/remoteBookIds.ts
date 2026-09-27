import { File, Paths } from 'expo-file-system';

// Account-scoped lookup only. An EPUB keeps its local ID for offline progress,
// while the backend owns the ID used for account operations.
type RemoteIds = Record<string, Record<string, string>>;
const file = () => new File(Paths.document, 'remote-book-ids.json');

export async function loadRemoteBookIds(subject: string): Promise<Record<string, string>> {
  try {
    const stored = file();
    if (!stored.exists) return {};
    const raw: unknown = JSON.parse(await stored.text());
    if (!raw || typeof raw !== 'object') return {};
    const ids = (raw as RemoteIds)[subject];
    if (!ids || typeof ids !== 'object') return {};
    return Object.fromEntries(Object.entries(ids).filter(([local, remote]) =>
      typeof local === 'string' && typeof remote === 'string'));
  } catch (error) {
    console.warn('[dodo] Could not read account book IDs:', String(error));
    return {};
  }
}

export async function saveRemoteBookId(subject: string, localId: string, remoteId: string): Promise<void> {
  const stored = file();
  let all: RemoteIds = {};
  try {
    if (stored.exists) all = JSON.parse(await stored.text()) as RemoteIds;
  } catch {
    // Recover from a corrupt lookup; local EPUBs are kept separately.
  }
  all[subject] = { ...all[subject], [localId]: remoteId };
  if (!stored.exists) stored.create();
  stored.write(JSON.stringify(all));
}

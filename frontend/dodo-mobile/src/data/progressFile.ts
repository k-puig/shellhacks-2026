import { File, Paths } from 'expo-file-system';

import { parsePositions, type Positions } from './readingProgress';

// Reading positions saved on the phone, so they survive closing the app.
// (Moves to the backend with accounts.)
const progressFile = () => new File(Paths.document, 'reading-progress.json');

export async function loadPositions(): Promise<Positions> {
  try {
    const file = progressFile();
    return file.exists ? parsePositions(await file.text()) : {};
  } catch (error) {
    console.log('[dodo] Could not read reading progress:', String(error));
    return {};
  }
}

export function savePositions(positions: Positions) {
  try {
    const file = progressFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(positions));
  } catch (error) {
    console.log('[dodo] Could not save reading progress:', String(error));
  }
}

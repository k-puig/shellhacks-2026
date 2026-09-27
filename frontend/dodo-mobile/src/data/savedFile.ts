import { File, Paths } from 'expo-file-system';

import { emptySavedItems, parseSavedItems, type SavedItems } from './savedItems';

// Highlights, notes and asked questions saved on the phone, so they survive
// closing the app. (Moves to the backend with accounts.)
const savedFile = () => new File(Paths.document, 'saved-items.json');

export async function loadSavedItems(): Promise<SavedItems> {
  try {
    const file = savedFile();
    return file.exists ? parseSavedItems(await file.text()) : emptySavedItems();
  } catch (error) {
    console.log('[dodo] Could not read saved items:', String(error));
    return emptySavedItems();
  }
}

export function saveSavedItems(items: SavedItems) {
  try {
    const file = savedFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(items));
  } catch (error) {
    console.log('[dodo] Could not save items:', String(error));
  }
}

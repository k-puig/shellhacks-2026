// Speech recognizers mishear "dodo" a lot, so accept the common variants.
// No bare "a dodo": the mic also hears the narrator, and books (Alice!) can say it.
const WAKE = /\b(?:hey|hi|ok|okay)[\s,]+(?:dodo|do do|doto|dodos|dough dough|toto|dudu)\b/g;

const clean = (text: string) => text.replace(/^[\s,.]+/, '').trim();

// Reads one recognition result (its alternative transcripts). Returns whether
// it contains the wake word and the command text, or null if it's not for us.
export function readResult(
  transcripts: string[],
  awake: boolean,
): { woke: boolean; command: string } | null {
  // Use the first alternative that contains the wake word: "hey dodo" is
  // often only the 2nd or 3rd guess.
  for (const alt of transcripts) {
    const text = alt.toLowerCase();
    const found = [...text.matchAll(WAKE)].pop();
    if (found) return { woke: true, command: clean(text.slice(found.index + found[0].length)) };
  }
  // Already awake: iOS starts a fresh transcript after a pause, so "Hey DODO
  // … play" arrives as "hey dodo" and then "play" on its own.
  const command = clean((transcripts[0] ?? '').toLowerCase());
  if (awake && command) return { woke: false, command };
  return null;
}

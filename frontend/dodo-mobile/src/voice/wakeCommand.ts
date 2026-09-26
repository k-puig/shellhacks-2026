// Speech recognizers mishear "dodo" a lot, especially in a noisy room, so
// accept the common variants. Always needs "hey"/"hi"/"ok" first: the mic also
// hears the narrator, and books (Alice has a Dodo!) say "dodo" on their own.
const WAKE =
  /\b(?:hey|hi|ok|okay)[\s,.!]+(?:do[\s-]?do(?:'s|s)?|doto|dough[\s-]?dough|doe[\s-]?doe|doh[\s-]?doh|doodoo|todo|toto|dudu)\b/g;

const clean = (text: string) => text.replace(/^[\s,.]+/, '').trim();

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
const bare = (word: string | undefined) => (word ?? '').replace(/[^a-z0-9']/g, '');

// Drops the part of a transcript that was already there when the mic button was
// tapped. A transcript that starts differently is a fresh iOS segment: keep it all.
function saidSince(text: string, since: string): string {
  const before = words(since);
  const now = words(text);
  if (before.length === 0 || bare(now[0]) !== bare(before[0])) return text;
  return now.slice(before.length).join(' ');
}

// Reads one recognition result (its alternative transcripts). Returns whether
// it contains the wake word and the command text, or null if it's not for us.
// `since`: the transcript at the moment the mic button was tapped, if it was.
export function readResult(
  transcripts: string[],
  awake: boolean,
  since = '',
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
  const command = clean(saidSince(transcripts[0] ?? '', since).toLowerCase());
  if (awake && command) return { woke: false, command };
  return null;
}

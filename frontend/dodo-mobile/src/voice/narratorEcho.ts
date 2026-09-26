// With the narrator still playing (quieter) while DODO listens, the mic also
// hears the book. This spots transcripts that are the narrator, not the user.

const MIN_WORDS = 2;
// Share of the heard words that must appear, in order, in the recent book text.
const ECHO_RATIO = 0.6;

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9']/g, ''))
    .filter(Boolean);

export function isNarratorEcho(heard: string, recentBookText: string): boolean {
  const said = words(heard);
  // One-word commands ("pause") are common and too short to judge.
  if (said.length < MIN_WORDS) return false;

  const book = words(recentBookText);
  let matched = 0;
  let at = 0;
  for (const word of said) {
    const found = book.indexOf(word, at);
    if (found === -1) continue;
    matched++;
    at = found + 1;
  }
  return matched / said.length >= ECHO_RATIO;
}

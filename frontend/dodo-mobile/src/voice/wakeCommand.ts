// Speech recognizers mishear "hey nova" a lot, especially in a noisy room, so
// accept the common variants:
// - "hey"/"hi"/"ok" + "nova" (or a mishearing of it), anywhere;
// - "hey nova" run together: "Hanover", "Hanova", "hangover", "hang over", "Anova";
// - a bare "Nova" only at the start of what was said ("Nova, pause"): iOS often
//   drops the "hey", but books say "Nova" mid-sentence, and the mic can still
//   hear the narrator.
const NOVA = String.raw`(?:nova(?:'s|s|h)?|no[\s-]va|noba)`;
const WAKE = new RegExp(
  String.raw`(?:\b(?:hey|hay|hi|ok|okay)[\s,.!]+${NOVA}` +
    String.raw`|\b(?:hanover|hanova|hangover|hang[\s-]over|anova)` +
    String.raw`|^[\s,.]*(?:(?:a|uh|um|oh|and)[\s,.!]+)?${NOVA})\b`,
  'g',
);

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
  // Use the first alternative that contains the wake word: "hey nova" is
  // often only the 2nd or 3rd guess. Prefer one that also has a command: iOS
  // can offer "Hey Nova" first and "Hey Nova pause" second.
  const woken = transcripts.flatMap((alt) => {
    const text = alt.toLowerCase();
    const found = [...text.matchAll(WAKE)].pop();
    return found ? [{ woke: true, command: clean(text.slice(found.index + found[0].length)) }] : [];
  });
  if (woken.length > 0) return woken.find((r) => r.command) ?? woken[0];
  // Already awake: iOS starts a fresh transcript after a pause, so "Hey Nova
  // … play" arrives as "hey nova" and then "play" on its own.
  const command = clean(saidSince(transcripts[0] ?? '', since).toLowerCase());
  if (awake && command) return { woke: false, command };
  return null;
}

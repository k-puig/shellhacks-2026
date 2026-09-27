import { HIGHLIGHT_COLOR_NAMES, type HighlightColorName } from '@/theme';

export type Command =
  | { type: 'pause' }
  | { type: 'play' }
  | { type: 'highlight'; color?: HighlightColorName }
  | { type: 'note'; content: string }
  | { type: 'repeat' }
  | { type: 'skip' }
  | { type: 'nextChapter' }
  | { type: 'previousChapter' }
  | { type: 'faster' }
  | { type: 'slower' }
  | { type: 'question'; text: string }
  | { type: 'unknown'; heard: string };

const NOTE_PREFIX =
  /^(?:please\s+)?(?:(?:write|take|add|make|save)\s+(?:a\s+|this\s+)?note|note)\s*(?:that|saying|:)?\s*/;

// Phrases that ask about the book. Checked before the single-word commands,
// which match anywhere ("why did she stop?" must not pause).
const QUESTION =
  /^(?:(?:why|who|whom|whose|what|when|where|which|how|is|are|was|were|does|do|did)\b|explain\b|tell me\b|remind me\b|(?:can|could) you (?:explain|tell)\b)/;

// "What happened in the last chapter?" is a question, not chapter navigation.
const RECAP = /\bhappen(?:ed|s)?\b|\bremind me\b|\brecap\b|\bsummar/;

// Turns the words spoken after "Hey Nova" into an action.
export function parseCommand(raw: string): Command {
  const text = raw.toLowerCase().replace(/[.,!?]/g, '').trim();

  const note = text.match(NOTE_PREFIX);
  if (note) {
    // Keep the user's original casing for the note body.
    const content = raw.trim().slice(note[0].length).replace(/^[\s,:]+/, '').trim();
    return { type: 'note', content };
  }
  if (/\bhighlight|mark (?:that|this)|save (?:that|this)\b/.test(text)) {
    // Offline fallback for "highlight that in blue"; Gemini handles it normally.
    const color = HIGHLIGHT_COLOR_NAMES.find((c) => new RegExp(`\\b${c}\\b`).test(text));
    return color ? { type: 'highlight', color } : { type: 'highlight' };
  }
  if (!RECAP.test(text)) {
    if (/\bnext chapter\b/.test(text)) return { type: 'nextChapter' };
    if (/\b(?:previous|last) chapter\b/.test(text)) return { type: 'previousChapter' };
  }
  if (QUESTION.test(text) || RECAP.test(text) || raw.trim().endsWith('?')) {
    return { type: 'question', text: raw.trim() };
  }
  if (/\b(?:pause|stop|hold on|wait)\b/.test(text)) return { type: 'pause' };
  if (/\b(?:play|resume|continue|keep (?:going|reading)|go on)\b/.test(text)) return { type: 'play' };
  if (/\b(?:repeat|go back|rewind|again)\b/.test(text)) return { type: 'repeat' };
  if (/\b(?:skip|next)\b/.test(text)) return { type: 'skip' };
  if (/\b(?:faster|speed up)\b/.test(text)) return { type: 'faster' };
  if (/\b(?:slower|slow down)\b/.test(text)) return { type: 'slower' };
  return { type: 'unknown', heard: raw };
}

// Commands that are complete as soon as they're heard, so they run without
// waiting for silence. Excludes anything that can still grow: "next" (→ "next
// chapter"), highlights (→ "…in blue"), notes, and unrecognized requests.
const INSTANT: Command['type'][] = ['pause', 'play', 'faster', 'slower', 'nextChapter', 'previousChapter'];

export const isInstantCommand = (command: Command) => INSTANT.includes(command.type);

// "Highlight that" with nothing more to it: the sentence just read, done on the
// phone right away. Anything that describes what to highlight goes to Gemini.
export const isBareHighlight = (raw: string) =>
  /^(?:highlight|mark|save)(?: (?:that|this|it))?(?: please)?$/.test(
    raw.toLowerCase().replace(/[.,!?]/g, '').trim(),
  );

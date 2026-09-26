import { generateJson } from '@/ai/gemini';
import type { Paragraph } from '@/data/mockBooks';
import { HIGHLIGHT_COLOR_NAMES, type HighlightColorName } from '@/theme';

// Turns what the user said after "Hey DODO" into a precise highlight or note,
// using Gemini to understand the request against the text they just heard.

export { isGeminiConfigured } from '@/ai/gemini';

const TIMEOUT_MS = 8000;
// How many sentences of recent narration Gemini gets to choose from.
const CONTEXT_SENTENCES = 10;

export type Sentence = { id: string; startIdx: number; endIdx: number; text: string };

export type Interpretation =
  | {
      action: 'highlight';
      startIdx: number;
      endIdx: number;
      color?: HighlightColorName;
      reply: string;
    }
  | { action: 'note'; wordIdx: number; content: string; reply: string }
  | { action: 'answer'; reply: string }
  | { action: 'none'; reply: string };

const endsSentence = (word: string) => /[.!?]["')\]]*$/.test(word);

// Splits the book into sentences with global word ranges. Call once per book.
export function splitSentences(paragraphs: Paragraph[]): Sentence[] {
  const sentences: Sentence[] = [];
  for (const p of paragraphs) {
    let start = 0;
    p.words.forEach((w, i) => {
      if (endsSentence(w.text) || i === p.words.length - 1) {
        const words = p.words.slice(start, i + 1);
        sentences.push({
          id: `s${sentences.length}`,
          startIdx: words[0].idx,
          endIdx: w.idx,
          text: words.map((x) => x.text).join(' '),
        });
        start = i + 1;
      }
    });
  }
  return sentences;
}

// The last few sentences up to (and including) the one being read.
export function recentSentences(sentences: Sentence[], currentIdx: number): Sentence[] {
  const at = sentences.findIndex((s) => currentIdx >= s.startIdx && currentIdx <= s.endIdx);
  const end = at === -1 ? sentences.length - 1 : at;
  return sentences.slice(Math.max(0, end - CONTEXT_SENTENCES + 1), end + 1);
}

const SYSTEM_PROMPT = `You are DODO, the voice assistant inside an audiobook app. The user is listening to a book and just said a command after "Hey DODO". Decide what they want saved.

You get the command (an English speech transcript, so expect filler words and small mishearings) and the most recent sentences of the book, oldest first, each with an id. The LAST sentence is the one being read right now.

Actions:
- "highlight": the user wants part of the text highlighted. Put the ids of the sentence(s) they mean in sentenceIds (consecutive, in order). If they clearly mean only part of a sentence (a phrase or quote), also put those exact words, copied verbatim from the text, in quote. If they name a color, set color to the closest of: ${HIGHLIGHT_COLOR_NAMES.join(', ')} (e.g. "gold" → yellow, "red" → pink, "violet" → purple); otherwise leave color out.
- "note": the user wants to save a note. Write the note in noteContent as clean, concise English in the user's own voice — fix transcription errors and drop filler like "um" or "write a note saying", but do not invent content. Put the id of the sentence the note is about in anchorSentenceId.
- "answer": the user is asking a question about the book (what a word means, why something happened, who someone is, what's going on). Leave the other fields out; DODO answers it separately.
- "none": the request is not about highlighting, notes or the book, or you cannot tell what they mean.

Resolving references: "that", "this", "just now" mean the sentence being read or the one right before it. "The last two sentences" means the two most recent. "The part about X" means the sentence(s) that mention X — search all provided sentences.

Always set reply: a very short confirmation shown on screen (max 8 words), e.g. "Highlighted the watch line" or "Noted: foreshadowing".`;

// Gemini structured-output schema (OpenAPI subset).
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    action: { type: 'STRING', enum: ['highlight', 'note', 'answer', 'none'] },
    sentenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
    quote: { type: 'STRING' },
    color: { type: 'STRING', enum: HIGHLIGHT_COLOR_NAMES },
    noteContent: { type: 'STRING' },
    anchorSentenceId: { type: 'STRING' },
    reply: { type: 'STRING' },
  },
  required: ['action', 'reply'],
};

type RawDecision = {
  action?: unknown;
  sentenceIds?: unknown;
  quote?: unknown;
  color?: unknown;
  noteContent?: unknown;
  anchorSentenceId?: unknown;
  reply?: unknown;
};

function callGemini(command: string, context: Sentence[]): Promise<RawDecision> {
  return generateJson<RawDecision>({
    system: SYSTEM_PROMPT,
    user: JSON.stringify({
      command,
      sentences: context.map((s) => ({ id: s.id, text: s.text })),
    }),
    schema: RESPONSE_SCHEMA,
    timeoutMs: TIMEOUT_MS,
  });
}

const normalize = (word: string) => word.toLowerCase().replace(/[^a-z0-9']/g, '');

// Finds a quoted phrase inside the chosen word span so partial highlights land
// on exact words. Returns null if the quote isn't there verbatim.
function locateQuote(
  quote: string,
  words: { text: string; idx: number }[],
): { startIdx: number; endIdx: number } | null {
  const target = quote.split(/\s+/).map(normalize).filter(Boolean);
  if (target.length === 0) return null;
  const norm = words.map((w) => normalize(w.text));
  for (let i = 0; i + target.length <= norm.length; i++) {
    if (target.every((t, j) => norm[i + j] === t)) {
      return { startIdx: words[i].idx, endIdx: words[i + target.length - 1].idx };
    }
  }
  return null;
}

// Asks Gemini what the user meant and converts the answer into global word
// indices. Throws on network/parse/validation failure so the caller can fall
// back to the simple rule-based behavior.
export async function interpretCommand(
  command: string,
  context: Sentence[],
  words: { text: string; idx: number }[],
): Promise<Interpretation> {
  const raw = await callGemini(command, context);
  const reply = typeof raw.reply === 'string' && raw.reply.trim() ? raw.reply.trim() : '';
  const byId = new Map(context.map((s) => [s.id, s]));

  if (raw.action === 'highlight') {
    const chosen = (Array.isArray(raw.sentenceIds) ? raw.sentenceIds : [])
      .map((id) => byId.get(String(id)))
      .filter((s): s is Sentence => Boolean(s));
    if (chosen.length === 0) throw new Error('Gemini picked no valid sentences');
    const startIdx = Math.min(...chosen.map((s) => s.startIdx));
    const endIdx = Math.max(...chosen.map((s) => s.endIdx));
    const span = words.filter((w) => w.idx >= startIdx && w.idx <= endIdx);
    const exact = typeof raw.quote === 'string' ? locateQuote(raw.quote, span) : null;
    const color = HIGHLIGHT_COLOR_NAMES.find((c) => c === raw.color);
    return {
      action: 'highlight',
      ...(exact ?? { startIdx, endIdx }),
      color,
      reply: reply || 'Highlighted',
    };
  }

  if (raw.action === 'note') {
    const content = typeof raw.noteContent === 'string' ? raw.noteContent.trim() : '';
    if (!content) throw new Error('Gemini returned an empty note');
    // Anchor at the end of the sentence the note is about (default: current one).
    const anchor = byId.get(String(raw.anchorSentenceId)) ?? context[context.length - 1];
    return { action: 'note', wordIdx: anchor.endIdx, content, reply: reply || 'Noted' };
  }

  if (raw.action === 'answer') return { action: 'answer', reply };

  return { action: 'none', reply: reply || "Didn't catch that" };
}

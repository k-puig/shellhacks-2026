import { HIGHLIGHT_COLOR_NAMES, type HighlightColorName } from '@/theme';

// ElevenLabs voices chosen for reading books aloud.
export type Voice = { id: string; name: string; description: string };
export const VOICES: Voice[] = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'British · warm storyteller' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'British · velvety' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'British · clear, engaging' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', description: 'American · deep, comforting' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'British · steady broadcaster' },
  { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella', description: 'American · bright, warm' },
];

export function voiceById(id: string): Voice {
  return VOICES.find((v) => v.id === id) ?? { id, name: 'Custom voice', description: '' };
}

// After DODO answers a question: pick the book back up after a short or
// normal pause, or stay paused.
export type ResumeAfterAnswer = 'short' | 'normal' | 'off';
const RESUME_CHOICES: ResumeAfterAnswer[] = ['short', 'normal', 'off'];

export function resumeDelayMs(choice: ResumeAfterAnswer): number | null {
  return choice === 'short' ? 1000 : choice === 'normal' ? 2000 : null;
}

export const MIN_RATE = 0.5;
export const MAX_RATE = 2;
export const clampRate = (rate: number) =>
  Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(rate * 10) / 10));

export type Settings = {
  voiceId: string;
  rate: number;
  resumeAfterAnswer: ResumeAfterAnswer;
  // Always listen for "Hey Nova"; when off, the mic button still works.
  wakeWord: boolean;
  haptics: boolean;
  highlightColor: HighlightColorName;
};

export const DEFAULT_SETTINGS: Settings = {
  voiceId: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID ?? VOICES[0].id,
  rate: 1,
  resumeAfterAnswer: 'normal',
  wakeWord: true,
  haptics: true,
  highlightColor: 'yellow',
};

// Reads the saved file; missing, corrupted or invalid values fall back to the
// defaults one field at a time.
export function parseSettings(json: string | null): Settings {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = json ? JSON.parse(json) : {};
    if (typeof parsed === 'object' && parsed !== null) raw = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_SETTINGS;
  }
  const d = DEFAULT_SETTINGS;
  return {
    voiceId: typeof raw.voiceId === 'string' && raw.voiceId ? raw.voiceId : d.voiceId,
    rate: typeof raw.rate === 'number' && Number.isFinite(raw.rate) ? clampRate(raw.rate) : d.rate,
    resumeAfterAnswer: RESUME_CHOICES.includes(raw.resumeAfterAnswer as ResumeAfterAnswer)
      ? (raw.resumeAfterAnswer as ResumeAfterAnswer)
      : d.resumeAfterAnswer,
    wakeWord: typeof raw.wakeWord === 'boolean' ? raw.wakeWord : d.wakeWord,
    haptics: typeof raw.haptics === 'boolean' ? raw.haptics : d.haptics,
    highlightColor: HIGHLIGHT_COLOR_NAMES.includes(raw.highlightColor as HighlightColorName)
      ? (raw.highlightColor as HighlightColorName)
      : d.highlightColor,
  };
}

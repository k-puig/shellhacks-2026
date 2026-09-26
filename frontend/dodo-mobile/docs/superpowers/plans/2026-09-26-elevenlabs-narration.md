# ElevenLabs Narration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reader's `expo-speech` narrator with ElevenLabs text-to-speech, keeping word highlighting, play/pause/seek/speed, and "Hey DODO" voice commands working.

**Architecture:** One ElevenLabs `/with-timestamps` request per paragraph returns MP3 audio plus per-character timings. The audio is written to the cache folder and played with `expo-audio`. The timings are turned into per-word start times, and the playback position picks the highlighted word. `useNarration` keeps its return value, so the reader barely changes. The next paragraph is prefetched while the current one plays.

**Tech Stack:** Expo SDK 57, React Native 0.86, `expo-audio`, `expo-file-system` (new `File`/`Paths` API), ElevenLabs REST API (`eleven_flash_v2_5`), Jest via `jest-expo`.

**Spec:** `docs/superpowers/specs/2026-09-26-elevenlabs-narration-design.md`

All paths below are relative to `frontend/dodo-mobile/`. Work on branch `feature/elevenlabs-narration`.

## Before you start (the human does this)

1. Create an account at https://elevenlabs.io.
2. Profile → **API Keys** → create a key. It needs the **Text to Speech** permission.
3. Optional: in **Voices**, pick a voice, copy its **Voice ID**. Without one, the app uses the default voice `JBFqnCBsd6RMkjVDRZzb` ("George").
4. Add to `.env.local` (git-ignored, never commit it):

```
EXPO_PUBLIC_ELEVENLABS_API_KEY=<your key>
# Optional:
EXPO_PUBLIC_ELEVENLABS_VOICE_ID=<voice id>
```

The free tier includes a limited number of characters per month; a paragraph costs roughly its length in characters (flash models cost about half). Check the remaining credits in the ElevenLabs dashboard before the demo.

## Global Constraints

- Expo SDK 57. Install every package with `npx expo install <pkg>` (never `npm install`).
- Model `eleven_flash_v2_5`; endpoint `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/with-timestamps`; auth header `xi-api-key`.
- Key from `EXPO_PUBLIC_ELEVENLABS_API_KEY`; voice from `EXPO_PUBLIC_ELEVENLABS_VOICE_ID`, default `JBFqnCBsd6RMkjVDRZzb`.
- No fallback to `expo-speech`; remove the package.
- `useNarration` return value stays `paragraphs, currentIdx, currentIdxRef, isPlaying, rate, voiceName, play, pause, seek, changeRate`, plus `error: string`.
- Speed range 0.5–2.0 in 0.1 steps (unchanged).
- Audio mode: `allowsRecording: true`, `playsInSilentMode: true`, `interruptionMode: 'mixWithOthers'`, `shouldRouteThroughEarpiece: false`; the player uses `keepAudioSessionActive: true`.
- `iosVoiceProcessingEnabled` stays `false` in `useWakeWord.ts`.
- No automatic retries of failed ElevenLabs requests. Request timeout 15 s.
- Error strings, exactly: `Add EXPO_PUBLIC_ELEVENLABS_API_KEY to .env.local`, `ElevenLabs: couldn't connect`, `ElevenLabs: invalid API key`, `ElevenLabs: out of credits`, `ElevenLabs: error <status>`.
- Before any commit: `npx tsc --noEmit` and `npx expo lint` pass.

## Review Focus

1. **Pausing for "Hey DODO" must not kill the mic.** Without `keepAudioSessionActive: true`, `expo-audio` deactivates the iOS audio session on pause, which stops the recognizer: the same "worked once, then dead" failure seen earlier. Covered by Task 5 checklist item 5.
2. **ElevenLabs returns out-of-credits as HTTP 401** with `detail.status === 'quota_exceeded'`, not 429. Users must see "out of credits", not "invalid API key". Covered by a unit test in Task 2.
3. **ElevenLabs may normalize text** (trim, collapse spaces), so `alignment.characters` need not match the input exactly; highlighting must still line up. Covered by unit tests in Task 1.
4. **Seeking into the middle of a different paragraph** must wait for the new audio to load before seeking, or the seek is ignored and playback starts at the paragraph's first word. Covered by Task 5 checklist item 4.
5. **Rapid play/pause/tap-to-seek** must never play two paragraphs at once or resume after a pause. The session counter drops stale results. Covered by Task 5 checklist item 8.

---

### Task 1: Test runner and word-timing logic

**Files:**
- Modify: `package.json` (dev dependencies, `test` script, `jest` preset)
- Modify: `tsconfig.json` (add `"types": ["jest"]`)
- Create: `src/narration/wordTimings.ts`
- Test: `src/narration/__tests__/wordTimings.test.ts`

**Interfaces:**
- Produces: `wordStartTimes(text: string, characters: string[], charStartTimes: number[]): number[]` and `wordAt(wordStarts: number[], seconds: number): number`.

- [ ] **Step 1: Install Jest**

Run: `npx expo install jest-expo jest @types/jest --dev`

Then in `package.json` add to `"scripts"`: `"test": "jest"`, and add a top-level key:

```json
"jest": {
  "preset": "jest-expo"
}
```

In `tsconfig.json`, add `"types": ["jest"]` inside `compilerOptions`.

- [ ] **Step 2: Write the failing tests**

Create `src/narration/__tests__/wordTimings.test.ts`:

```ts
import { wordAt, wordStartTimes } from '../wordTimings';

// Builds what ElevenLabs returns: one entry per character, each starting 0.1s after the last.
const align = (s: string) => ({
  characters: [...s],
  times: [...s].map((_, i) => Math.round(i * 10) / 100),
});

describe('wordStartTimes', () => {
  it('gives the start time of each word', () => {
    const text = 'Alice was beginning';
    const { characters, times } = align(text);
    // Words start at characters 0, 6 and 10.
    expect(wordStartTimes(text, characters, times)).toEqual([0, 0.6, 1]);
  });

  it('keeps punctuation attached to its word', () => {
    const text = '“Oh dear! Oh dear!”';
    const { characters, times } = align(text);
    expect(wordStartTimes(text, characters, times)).toEqual([0, 0.4, 1, 1.3]);
  });

  it('handles a single word', () => {
    const { characters, times } = align('Curiouser!');
    expect(wordStartTimes('Curiouser!', characters, times)).toEqual([0]);
  });

  it('still lines up when ElevenLabs collapsed repeated spaces', () => {
    const sent = 'down  the   hole';
    const { characters, times } = align('down the hole');
    expect(wordStartTimes(sent, characters, times)).toEqual([0, 0.5, 0.9]);
  });

  it('still lines up when ElevenLabs trimmed a leading space', () => {
    const { characters, times } = align('rabbit hole');
    expect(wordStartTimes(' rabbit hole', characters, times)).toEqual([0, 0.7]);
  });

  it('never goes backwards when a word cannot be found', () => {
    const { characters, times } = align('one two');
    expect(wordStartTimes('one zzz two', characters, times)).toEqual([0, 0, 0.4]);
  });
});

describe('wordAt', () => {
  const starts = [0, 0.6, 1];

  it('is the first word before any audio has played', () => {
    expect(wordAt(starts, -1)).toBe(0);
  });

  it('switches exactly on a word boundary', () => {
    expect(wordAt(starts, 0.6)).toBe(1);
  });

  it('stays on a word between boundaries', () => {
    expect(wordAt(starts, 0.8)).toBe(1);
  });

  it('is the last word after the end', () => {
    expect(wordAt(starts, 99)).toBe(2);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/narration`
Expected: FAIL with "Cannot find module '../wordTimings'".

- [ ] **Step 4: Implement**

Create `src/narration/wordTimings.ts`:

```ts
// Turns ElevenLabs' per-character timings into per-word timings. Words are the
// whitespace-separated tokens of the text we sent, i.e. the book's words.
export function wordStartTimes(
  text: string,
  characters: string[],
  charStartTimes: number[],
): number[] {
  // Find each word in what ElevenLabs actually spoke rather than trusting
  // character offsets, since it may trim or collapse whitespace.
  const spoken = characters.join('');
  const starts: number[] = [];
  let cursor = 0;
  let last = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const at = spoken.indexOf(word, cursor);
    if (at !== -1) {
      last = Math.max(last, charStartTimes[at] ?? last);
      cursor = at + word.length;
    }
    starts.push(last);
  }
  return starts;
}

// Index of the word being spoken at a playback position (seconds).
export function wordAt(wordStarts: number[], seconds: number): number {
  let i = 0;
  while (i + 1 < wordStarts.length && wordStarts[i + 1] <= seconds) i++;
  return i;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/narration`
Expected: PASS, 10 tests.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npx expo lint
git add package.json package-lock.json tsconfig.json src/narration/wordTimings.ts src/narration/__tests__/wordTimings.test.ts
git commit -m "Add word timing logic for ElevenLabs narration, with Jest"
```

---

### Task 2: ElevenLabs client

**Files:**
- Create: `src/narration/elevenlabs.ts`
- Test: `src/narration/__tests__/elevenlabs.test.ts`
- Modify: `package.json` (add `expo-file-system`)
- Modify: `docs/superpowers/specs/2026-09-26-elevenlabs-narration-design.md` (stale-work bullet)

**Interfaces:**
- Consumes: `wordStartTimes` from Task 1.
- Produces:
  - `type Narration = { fileUri: string; wordStarts: number[] }`
  - `synthesize(text: string): Promise<Narration>` (cached per text)
  - `isElevenLabsConfigured(): boolean`
  - `class ElevenLabsError extends Error` (its `message` is the user-facing string)
  - `errorMessage(status: number, detailStatus?: string): string`
  - `MISSING_KEY_MESSAGE: string`

- [ ] **Step 1: Install the file system module**

Run: `npx expo install expo-file-system`

- [ ] **Step 2: Write the failing tests**

Create `src/narration/__tests__/elevenlabs.test.ts`:

```ts
// The client writes audio files; the error mapping under test never does.
jest.mock('expo-file-system', () => ({}));

import { errorMessage } from '../elevenlabs';

describe('errorMessage', () => {
  it('reports a bad key', () => {
    expect(errorMessage(401)).toBe('ElevenLabs: invalid API key');
  });

  it('reports running out of credits, which ElevenLabs sends as a 401', () => {
    expect(errorMessage(401, 'quota_exceeded')).toBe('ElevenLabs: out of credits');
  });

  it('reports rate limiting as out of credits', () => {
    expect(errorMessage(429)).toBe('ElevenLabs: out of credits');
  });

  it('reports anything else with its status', () => {
    expect(errorMessage(500)).toBe('ElevenLabs: error 500');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/narration/__tests__/elevenlabs.test.ts`
Expected: FAIL with "Cannot find module '../elevenlabs'".

- [ ] **Step 4: Implement**

Create `src/narration/elevenlabs.ts`:

```ts
import { File, Paths } from 'expo-file-system';

import { wordStartTimes } from './wordTimings';

// ElevenLabs text-to-speech for narration. The key is read from
// EXPO_PUBLIC_ELEVENLABS_API_KEY (.env.local). EXPO_PUBLIC_ vars are bundled
// into the app: fine for the hackathon demo, but move this call to the backend
// before shipping.

const API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
// Defaults to "George", one of ElevenLabs' current default voices.
const VOICE_ID = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb';
const MODEL = 'eleven_flash_v2_5';
const TIMEOUT_MS = 15_000;

export const MISSING_KEY_MESSAGE = 'Add EXPO_PUBLIC_ELEVENLABS_API_KEY to .env.local';

export const isElevenLabsConfigured = () => Boolean(API_KEY);

export type Narration = { fileUri: string; wordStarts: number[] };

// Its message is shown to the user as is.
export class ElevenLabsError extends Error {}

export function errorMessage(status: number, detailStatus?: string): string {
  if (detailStatus === 'quota_exceeded' || status === 429) return 'ElevenLabs: out of credits';
  if (status === 401) return 'ElevenLabs: invalid API key';
  return `ElevenLabs: error ${status}`;
}

type WithTimestamps = {
  audio_base64: string;
  alignment: { characters: string[]; character_start_times_seconds: number[] };
};

// One entry per paragraph text, so replaying or seeking back costs no credits.
// Failed requests are dropped so pressing play again retries them.
const cache = new Map<string, Promise<Narration>>();
let fileCount = 0;

export function synthesize(text: string): Promise<Narration> {
  let request = cache.get(text);
  if (!request) {
    request = fetchNarration(text);
    cache.set(text, request);
    request.catch(() => cache.delete(text));
  }
  return request;
}

async function fetchNarration(text: string): Promise<Narration> {
  if (!API_KEY) throw new ElevenLabsError(MISSING_KEY_MESSAGE);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`, {
      method: 'POST',
      headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL }),
      signal: controller.signal,
    });
  } catch {
    throw new ElevenLabsError("ElevenLabs: couldn't connect");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    console.log('[dodo] ElevenLabs error', res.status, JSON.stringify(body));
    throw new ElevenLabsError(errorMessage(res.status, body?.detail?.status));
  }

  const json = (await res.json()) as WithTimestamps;
  const file = new File(Paths.cache, `narration-${Date.now()}-${fileCount++}.mp3`);
  file.create({ overwrite: true });
  file.write(json.audio_base64, { encoding: 'base64' });

  return {
    fileUri: file.uri,
    wordStarts: wordStartTimes(
      text,
      json.alignment.characters,
      json.alignment.character_start_times_seconds,
    ),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/narration`
Expected: PASS, 14 tests (10 from Task 1 + 4).

- [ ] **Step 6: Update the spec to match**

Requests are not cancelled: a stale result is simply cached, which costs at most one paragraph. In `docs/superpowers/specs/2026-09-26-elevenlabs-narration-design.md`, replace the **Stale work** bullet with:

```md
- **Stale work**: the existing `session` counter stays. Every play, pause and
  seek bumps it, and a synthesis that resolves for an old session is not
  played. Requests are not cancelled: their audio is cached for later, which
  costs at most one extra paragraph.
```

and in the `elevenlabs.ts` section change the signature line to `synthesize(paragraphText: string): Promise<{ fileUri: string; wordStarts: number[] }>`.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npx expo lint
git add package.json package-lock.json src/narration/elevenlabs.ts src/narration/__tests__/elevenlabs.test.ts docs/superpowers/specs/2026-09-26-elevenlabs-narration-design.md
git commit -m "Add ElevenLabs text-to-speech client"
```

---

### Task 3: Play narration through expo-audio

**Files:**
- Rewrite: `src/narration/useNarration.ts`
- Modify: `src/app/screens/reader.tsx:443-451` (status line shows `narration.error`)
- Modify: `package.json` (add `expo-audio`, remove `expo-speech`)
- Modify: `docs/superpowers/specs/2026-09-26-elevenlabs-narration-design.md` (audio mode section)

**Interfaces:**
- Consumes: `synthesize`, `isElevenLabsConfigured`, `ElevenLabsError`, `MISSING_KEY_MESSAGE` from Task 2; `wordAt` from Task 1.
- Produces: `useNarration(book)` returning `{ paragraphs, currentIdx, currentIdxRef, isPlaying, rate, voiceName, error, play, pause, seek, changeRate }`, with the same types as today plus `error: string`.

- [ ] **Step 1: Swap the packages**

```bash
npx expo install expo-audio
npm uninstall expo-speech
grep -rn "expo-speech'" src   # expect only matches for expo-speech-recognition
```

Do not add the `expo-audio` config plugin to `app.json`: it isn't needed for foreground playback, and its `microphonePermission` would compete with the one `expo-speech-recognition` already sets.

- [ ] **Step 2: Rewrite `src/narration/useNarration.ts`**

Replace the whole file with:

```ts
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Book, Paragraph } from '@/data/mockBooks';

import {
  ElevenLabsError,
  isElevenLabsConfigured,
  MISSING_KEY_MESSAGE,
  synthesize,
} from './elevenlabs';
import { wordAt } from './wordTimings';

// How often the player reports its position, which drives word highlighting.
const UPDATE_INTERVAL_MS = 100;

const paragraphText = (p: Paragraph) => p.words.map((w) => w.text).join(' ');

// Resolves once the player's current source is ready to seek.
function whenLoaded(player: AudioPlayer): Promise<void> {
  if (player.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.isLoaded) return;
      sub.remove();
      resolve();
    });
  });
}

// Narrator using ElevenLabs. It plays one paragraph at a time and reports the
// global word idx being spoken, derived from ElevenLabs' character timings.
export function useNarration(book: Book) {
  const paragraphs = useMemo(() => book.chapters.flatMap((c) => c.paragraphs), [book]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState('');

  // keepAudioSessionActive: pausing must not deactivate the iOS audio
  // session, or the always-on "Hey DODO" listener loses the mic.
  const player = useAudioPlayer(null, {
    updateInterval: UPDATE_INTERVAL_MS,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);

  // Bumped on every play/pause so results for an abandoned request are ignored.
  const session = useRef(0);
  const currentIdxRef = useRef(0);
  const playingRef = useRef(false);
  const rateRef = useRef(1);
  // The paragraph in the player and its word start times (seconds).
  const loaded = useRef<{ paragraph: Paragraph; wordStarts: number[] } | null>(null);

  useEffect(() => {
    // Match the wake-word listener's session (playAndRecord, mixWithOthers,
    // speaker) so neither side reconfigures iOS audio when it starts or stops.
    setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  const moveTo = (idx: number) => {
    currentIdxRef.current = idx;
    setCurrentIdx(idx);
  };

  const setPlaying = (value: boolean) => {
    playingRef.current = value;
    setIsPlaying(value);
  };

  const findParagraph = (idx: number): Paragraph | undefined =>
    paragraphs.find((p) => p.words[p.words.length - 1].idx >= idx);

  const nextParagraph = (paragraph: Paragraph): Paragraph | undefined =>
    paragraphs[paragraphs.indexOf(paragraph) + 1];

  const speakFrom = async (idx: number) => {
    const paragraph = findParagraph(idx);
    if (!paragraph) {
      setPlaying(false);
      return;
    }
    const mySession = ++session.current;
    const offset = Math.max(0, paragraph.words.findIndex((w) => w.idx >= idx));
    moveTo(paragraph.words[offset].idx);

    try {
      // Same paragraph already in the player (resume, or a tap inside it):
      // just seek, no new request.
      let current = loaded.current;
      if (current?.paragraph !== paragraph) {
        const audio = await synthesize(paragraphText(paragraph));
        if (session.current !== mySession) return;
        player.replace({ uri: audio.fileUri });
        current = { paragraph, wordStarts: audio.wordStarts };
        loaded.current = current;
        await whenLoaded(player);
        if (session.current !== mySession) return;
      }
      await player.seekTo(current.wordStarts[offset]);
      if (session.current !== mySession) return;
      player.setPlaybackRate(rateRef.current, 'high');
      player.play();
      setError('');

      // Fetch the next paragraph now so it starts without a gap. A failure
      // here is ignored; it is fetched again when it is reached.
      const next = nextParagraph(paragraph);
      if (next) synthesize(paragraphText(next)).catch(() => {});
    } catch (e) {
      if (session.current !== mySession) return;
      setPlaying(false);
      setError(e instanceof ElevenLabsError ? e.message : "ElevenLabs: couldn't connect");
    }
  };

  // Highlight the word at the current playback position.
  useEffect(() => {
    const current = loaded.current;
    if (!current || !playingRef.current) return;
    const word = current.paragraph.words[wordAt(current.wordStarts, status.currentTime)];
    if (word && word.idx !== currentIdxRef.current) moveTo(word.idx);
    // moveTo only touches a ref and a state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.currentTime]);

  // Paragraph finished: continue with the next one, or stop at the end.
  useEffect(() => {
    if (!status.didJustFinish || !playingRef.current || !loaded.current) return;
    const next = nextParagraph(loaded.current.paragraph);
    if (next) speakFrom(next.words[0].idx);
    else setPlaying(false);
    // speakFrom and nextParagraph only read refs and the paragraph list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  const play = (fromIdx = currentIdxRef.current) => {
    if (!isElevenLabsConfigured()) {
      setError(MISSING_KEY_MESSAGE);
      return;
    }
    player.pause();
    setPlaying(true);
    speakFrom(fromIdx);
  };

  const pause = () => {
    session.current++;
    player.pause();
    setPlaying(false);
  };

  const seek = (idx: number, keepPlaying: boolean) => {
    if (keepPlaying) play(idx);
    else moveTo(idx);
  };

  const changeRate = (delta: number) => {
    const next = Math.min(2, Math.max(0.5, Math.round((rateRef.current + delta) * 10) / 10));
    rateRef.current = next;
    setRate(next);
    player.setPlaybackRate(next, 'high');
  };

  useEffect(
    () => () => {
      session.current++;
    },
    [],
  );

  return {
    paragraphs,
    currentIdx,
    currentIdxRef,
    isPlaying,
    rate,
    voiceName: 'ElevenLabs',
    error,
    play,
    pause,
    seek,
    changeRate,
  };
}
```

If `npx tsc --noEmit` rejects `useAudioPlayer(null, …)`, check the installed type in `node_modules/expo-audio/build/` and pass the empty source it accepts; do not add a dummy audio file.

- [ ] **Step 3: Show narration errors in the reader**

In `src/app/screens/reader.tsx`, the status line (around line 443) currently reads:

```tsx
        {(feedback || voice.status !== 'listening') && (
```

and, a few lines below,

```tsx
              {feedback || statusLabel}
```

Just above the `return (` of the component, add:

```tsx
  // Command feedback first, then narration problems, then the mic's state.
  const message = feedback || narration.error;
```

and change those two lines to:

```tsx
        {(message || voice.status !== 'listening') && (
```

```tsx
              {message || statusLabel}
```

- [ ] **Step 4: Record the audio-session detail in the spec**

In the spec's "Audio mode (shared with the mic)" section, add after the code block:

```md
The player is created with `keepAudioSessionActive: true`. Without it,
`expo-audio` deactivates the iOS audio session on pause, which stops the
wake-word recognizer every time "Hey DODO" pauses the narrator.
```

- [ ] **Step 5: Run the checks**

```bash
npx jest src/narration
npx tsc --noEmit
npx expo lint
```

Expected: 14 tests pass, no type errors, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/narration/useNarration.ts src/app/screens/reader.tsx docs/superpowers/specs/2026-09-26-elevenlabs-narration-design.md
git commit -m "Narrate with ElevenLabs through expo-audio"
```

---

### Task 4: Restart the wake-word listener only once per session end

**Files:**
- Modify: `src/voice/useWakeWord.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no interface change.

Why: the native module can emit several `end` events for one recognition session (seen as three `end` events within 1 ms in device logs). Each one scheduled its own `start()`, and each native `start()` rebuilds the audio engine and re-activates the audio session, cutting out narration. This change keeps at most one restart pending.

- [ ] **Step 1: Add the restart timer**

Below `const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);` add:

```ts
  // The native module can emit several "end" events for one session, and each
  // native start() rebuilds the audio engine and re-activates the session,
  // which cuts out the narrator. So only ever keep one restart pending.
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 2: Add `scheduleStart`**

Directly above `const reset = () => {` add:

```ts
  const scheduleStart = (delayMs: number) => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      restartTimer.current = null;
      start();
    }, delayMs);
  };
```

- [ ] **Step 3: Route every restart through it**

In the `'end'` event handler, replace

```ts
    if (enabled.current && foreground.current) setTimeout(start, 250 * 2 ** failures.current);
```

with

```ts
    if (enabled.current && foreground.current) scheduleStart(250 * 2 ** failures.current);
```

In `begin()`, replace `setTimeout(start, 300);` with `scheduleStart(300);`.

- [ ] **Step 4: Clear it when stopping**

In `stopForBackground`, after `if (refreshTimer.current) clearTimeout(refreshTimer.current);` add:

```ts
    if (restartTimer.current) clearTimeout(restartTimer.current);
```

In the mount effect's cleanup, after `if (refreshTimer.current) clearTimeout(refreshTimer.current);` add the same line.

- [ ] **Step 5: Check and commit**

```bash
grep -n "setTimeout(start" src/voice/useWakeWord.ts   # expect no matches
npx tsc --noEmit && npx expo lint
git add src/voice/useWakeWord.ts
git commit -m "Restart the wake-word listener once per session end"
```

---

### Task 5: Build and verify on the phone

**Files:** none, unless a check fails.

- [ ] **Step 1: Build a Debug app on the phone**

`expo-audio` and `expo-file-system` add native code, so reloading is not enough.

```bash
npx expo run:ios --device
```

Pick the phone when asked. Phone and Mac must be on the same network (use a hotspot if the event Wi-Fi blocks it). Keep the terminal open: `[dodo]` logs appear there.

- [ ] **Step 2: Run the checklist, in order**

1. Open a book and press play: the voice is ElevenLabs and the highlight follows it word by word.
2. Let it cross into the next paragraph: no audible gap.
3. Change speed up and down (voice command "faster" / "slower"): pitch stays natural, highlight stays in sync.
4. Tap a word in the middle of the paragraph being read, then a word in the middle of a different paragraph: narration starts from each tapped word, not the start of the paragraph.
5. Say "Hey DODO, pause", wait, then "Hey DODO, play". Repeat three times: every command works.
6. Listen continuously for 2+ minutes (covers at least two of the mic's 45-second restarts): no cutouts, no switch to call audio.
7. Remove `EXPO_PUBLIC_ELEVENLABS_API_KEY` from `.env.local`, restart `npx expo start`, press play: the status line says "Add EXPO_PUBLIC_ELEVENLABS_API_KEY to .env.local" and nothing crashes. Put the key back.
8. Tap play/pause rapidly five times, then tap three different words quickly: only one voice ever plays, and it stops when paused.

- [ ] **Step 3: Fix and record**

For any failed item, go back to the owning task (1–2: Task 3; 3: Task 3; 4: Task 3 `whenLoaded`; 5–6: Tasks 3–4; 7: Tasks 2–3; 8: Task 3), fix with a test where the logic is testable, rerun the checks, and commit. When all 8 pass, note it in the pull request description.

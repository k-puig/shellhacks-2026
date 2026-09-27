# ElevenLabs narration

Date: 2026-09-26 · Status: draft for review

## Goal

Replace the on-device `expo-speech` narrator in the reader with ElevenLabs
text-to-speech. ElevenLabs is a ShellHacks sponsor, so the demo should show it
reading the book aloud, with the current word highlighted in sync, while
"Hey DODO" voice commands keep working.

Success means:

- The reader narrates a book with an ElevenLabs voice, paragraph after
  paragraph, until the end of the book or until paused.
- Word highlighting follows the voice as it does today.
- Play, pause, seek (tap a word) and speed changes all work.
- "Hey DODO, pause" / "Hey DODO, play" work repeatedly while narrating, and
  the narration does not cut out or switch to call audio.

## Decisions already made

- **API key lives in the app**: `EXPO_PUBLIC_ELEVENLABS_API_KEY` in
  `.env.local`, same approach as Gemini. Acceptable for the hackathon demo;
  anyone with the build can extract it. Moving it behind the Deno backend is
  out of scope.
- **Model**: `eleven_flash_v2_5` (fast first audio, lower credit cost).
- **Approach**: one `/with-timestamps` request per paragraph, prefetching the
  next paragraph while the current one plays. Streaming (WebSocket) and
  whole-chapter requests were rejected: `expo-audio` cannot play a live
  stream, and whole chapters delay playback and waste credits.
- **No fallback to `expo-speech`**: if ElevenLabs is unavailable the reader says
  so instead of switching to the device voice.

## Architecture

`useNarration(book)` keeps its return value:
`paragraphs, currentIdx, currentIdxRef, isPlaying, rate, voiceName, play,
pause, seek, changeRate`, plus one new field, `error` (string, empty when
fine). The only change to `reader.tsx` is showing `narration.error` in its
existing status line, the way it shows voice errors today.

### `src/narration/elevenlabs.ts` (new): API client

```ts
synthesize(paragraphText: string): Promise<{ fileUri: string; wordStarts: number[] }>
```

- `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/with-timestamps`
  with header `xi-api-key`, body `{ text, model_id: 'eleven_flash_v2_5' }`,
  default output format (`mp3_44100_128`).
- Voice from `EXPO_PUBLIC_ELEVENLABS_VOICE_ID`, falling back to a built-in
  default voice ID.
- Decodes `audio_base64` and writes it to an `.mp3` in the cache directory
  (`expo-file-system`), returning its URI.
- Converts `alignment.character_start_times_seconds` into one start time (in
  seconds) per word of the paragraph text it was given.
- In-memory cache keyed by paragraph text, so replaying or seeking back does
  not spend credits again. Cleared when the app restarts.
- `isElevenLabsConfigured()` reports whether the key is set.

### `src/narration/wordTimings.ts` (new): pure timing logic

Kept separate so it can be unit-tested without the network or audio:

- `wordStartTimes(text, characters, charStartTimes): number[]`: the start
  time of each word, where words are the space-separated tokens
  `useNarration` builds the text from (`word.text + ' '`).
- `wordAt(wordStarts, seconds): number`: the index of the word being spoken
  at a playback position (last word whose start ≤ position).

### `src/narration/useNarration.ts` (rewritten): playback

- One player from `useAudioPlayer()` and its status from
  `useAudioPlayerStatus()`.
- **Play from word idx**: find the paragraph containing idx, `synthesize` the
  whole paragraph (cached if already fetched), `player.replace(fileUri)`,
  `seekTo(wordStarts[offset])` when starting mid-paragraph, then `play()`.
  Always synthesizing whole paragraphs means seeking inside a paragraph costs
  no extra requests.
- **Highlighting**: when `status.currentTime` changes, `wordAt()` gives the
  word and `moveTo()` sets `currentIdx`, as `onBoundary` does today.
- **Next paragraph**: when `status.didJustFinish`, start the next paragraph.
  Its audio was prefetched when the current paragraph started, so there is
  no gap.
- **Speed**: `player.setPlaybackRate(rate, 'high')` (keeps pitch natural). Same
  0.5–2.0 range and 0.1 steps as today.
- **Stale work**: the existing `session` counter stays. Every play, pause and
  seek bumps it, and a synthesis that resolves for an old session is not
  played. Requests are not cancelled: their audio is cached for later, which
  costs at most one extra paragraph.
- `voiceName` is always `ElevenLabs`.

### Audio mode (shared with the mic)

Called once when narration mounts:

```ts
setAudioModeAsync({
  allowsRecording: true,
  playsInSilentMode: true,
  interruptionMode: 'mixWithOthers',
});
```

The player is created with `keepAudioSessionActive: true`. Without it,
`expo-audio` deactivates the iOS audio session on pause, which stops the
wake-word recognizer every time "Hey DODO" pauses the narrator.

This matches what the wake-word listener sets (`playAndRecord`,
`mixWithOthers`, speaker output), so neither the mic nor the player flips the
iOS audio session when it starts or stops. Flipping the session was the cause
of the earlier cutouts and call-audio switching. `iosVoiceProcessingEnabled`
stays `false` in `useWakeWord.ts`.

### Wake-word listener fix (re-apply)

The native speech-recognition module can emit several `end` events for one
session, and our handler restarted the mic once per event. Each restart
rebuilds the audio engine and re-activates the audio session. This fix was
written and confirmed from logs, but lost when the uncommitted changes were
dropped. Re-apply it: `useWakeWord.ts` keeps a single `restartTimer` so that
at most one restart is pending, and `begin()` and the `end` handler both go
through it.

## Error handling

| Case | Behavior |
|------|----------|
| No API key | `play()` does nothing and `error` = "Add EXPO_PUBLIC_ELEVENLABS_API_KEY to .env.local" |
| Network failure / timeout (15 s) | Stop on the current word; `error` = "ElevenLabs: couldn't connect" |
| 401 | `error` = "ElevenLabs: invalid API key" |
| 429 / quota | `error` = "ElevenLabs: out of credits" |
| Other non-200 | `error` = "ElevenLabs: error <status>" |

Pressing play again retries the paragraph. No automatic retries, so a failure
cannot silently burn credits. A failed prefetch is simply dropped; that paragraph
is fetched again when it is reached. `error` clears on the next successful play.

## Dependencies

- `expo-audio` and `expo-file-system`, installed with `npx expo install`.
  `expo-audio` has native code, so it needs a new phone build (Debug:
  `npx expo run:ios --device`).
- `expo-speech` is only used by narration today, so remove the package.
- `jest-expo` + `jest` for unit tests (the project has no test runner yet).

## Testing

**Unit tests** (`src/narration/__tests__/wordTimings.test.ts`):

- `wordStartTimes` on plain text, punctuation attached to words, repeated
  spaces, and a single-word paragraph.
- `wordAt` before the first word, exactly on a boundary, between words, and
  after the last word.

**On the phone** (Debug build), in order:

1. Play: the voice is ElevenLabs and the highlight follows it.
2. Let it cross a paragraph boundary: no audible gap.
3. Change speed up and down: pitch stays natural, highlight stays in sync.
4. Tap a word mid-paragraph: narration jumps there without a new request.
5. "Hey DODO, pause", then "Hey DODO, play", three times in a row: each works.
6. Listen continuously for 2+ minutes, covering at least two of the mic's
   45-second restarts: no cutouts, no switch to call audio.
7. Remove the key from `.env.local`, reload, press play: the error message
   shows and nothing crashes.

## Out of scope

- Moving the API key to the backend.
- Saving audio across app restarts, or downloading a book's audio in advance.
- Letting the user choose a voice.

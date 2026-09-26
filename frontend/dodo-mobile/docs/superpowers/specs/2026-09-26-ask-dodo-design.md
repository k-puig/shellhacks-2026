# Ask DODO: questions about the text

Date: 2026-09-26 · Status: draft for review

## Goal

Help listeners understand what they're reading. While the book plays, the user
asks a question about it ("Hey DODO, why is Alice bored?", "who's the Duchess
again?", "what does *countenance* mean?"). DODO answers out loud in a few
sentences, connecting the answer to earlier parts of the book, and saves the
question and answer in a new **Ask DODO** tab in Notes, under that book.

Success means:

- A spoken question gets a spoken answer in about 2 seconds, with the book still
  playing quietly underneath.
- Answers can draw on anything read so far, and never reveal what comes later.
- Every question and answer is saved and easy to find by book.
- Highlights, notes and other commands stay exactly as fast as today.
- The user can end their turn, or stop an answer, by tapping the mic button.

## Decisions already made

- **Context: everything read so far.** Gemini gets the book from the start up to
  the current sentence, capped at the most recent ~400,000 characters.
- **While DODO answers, the book keeps playing at 20% volume** (ducked). When
  the answer ends, narration rewinds to the sentence that was playing when the
  user asked and continues at full volume.
- **Question detection: approach A.** Phrases that look like questions go
  straight to the answering call; anything else goes to the existing
  interpreter, which gains an `answer` action as a fallback.
- **Voice:** the same ElevenLabs voice as the narrator.
- Q&A is stored locally for now; project 3 (accounts and backend) persists it.

## User flow

1. User says "Hey DODO" (or taps the mic): haptic tap, book ducks to 20%.
2. User asks a question. It ends after 1.3 s of silence, or when the user taps
   the mic again.
3. Status line shows "Thinking…". Gemini answers.
4. Success buzz; DODO speaks the answer over the ducked book; the answer text
   also shows in the status line.
5. When the answer ends (or is stopped), narration picks up where the user left
   off: it jumps back to the start of the sentence that was playing when they
   said "Hey DODO" (or tapped the mic) and continues at full volume, so nothing
   played under the answer is missed. If the book was paused when they asked,
   it stays paused.
6. The Q&A appears in Notes → Ask DODO, under the book, newest first.

## Components

### `src/voice/parseCommand.ts`: question detection

- New command type `{ type: 'question'; text: string }`.
- `parseCommand` returns it when the phrase starts like a question: `why`,
  `who`, `whom`, `whose`, `what`, `when`, `where`, `which`, `how`, `is`,
  `are`, `does`, `do`, `did`, `can`, `could`, `explain`, `tell me`,
  `remind me`, `what does … mean`, or ends with `?`.
- Order: note, highlight and next/previous chapter commands are checked first;
  then questions; then the single-word commands (pause, play, repeat, skip,
  faster, slower), which match a word anywhere and would otherwise swallow
  questions like "why did she stop?". "Can you pause" stays a pause: "can/could
  you" only counts as a question before "explain" or "tell".

### `src/ai/askDodo.ts` (new): answering

```ts
answerQuestion(question: string, book: Book, currentIdx: number):
  Promise<{ answer: string; title: string }>
```

- `bookSoFar(book, currentIdx, maxChars = 400_000): string` (pure): the book's
  text from the start through the end of the sentence containing `currentIdx`,
  with chapter titles as headings, keeping the most recent `maxChars` when
  longer, and ending with the marker `[The reader is here.]`.
- Calls Gemini (`EXPO_PUBLIC_GEMINI_MODEL`, default `gemini-3.5-flash-lite`)
  with structured output `{ answer: string, title: string }` and a 12 s timeout.
- Instructions: answer in 2–4 short spoken sentences, plain words, at the
  reader's level; connect to earlier events and characters when it helps; never
  mention or hint at anything after the marker; if the question isn't about the
  book, answer briefly and kindly. `title` is a label of at most 6 words, e.g.
  "Why the Rabbit is late".
- `parseAnswer(raw): { answer, title }` (pure): rejects an empty answer; falls
  back to the question (trimmed to 6 words) when `title` is missing.

### `src/voice/geminiInterpreter.ts`: fallback action

- Adds `answer` to the action enum and the instructions ("the user is asking a
  question about the book").
- New `Interpretation` case `{ action: 'answer'; reply: string }`. The reader
  then calls `answerQuestion`.

### `src/narration/useNarration.ts`: speaking an answer

- `speakAside(text: string, resumeFromIdx: number): Promise<void>`: fetches
  audio for `text` from ElevenLabs (no timestamps needed) on a second
  `useAudioPlayer`, ducks the narrator, and plays. When it finishes or is
  stopped, it unducks and, if the narrator was playing, seeks it to
  `resumeFromIdx` so narration picks up where the user left off.
- `stopAside()`: stops the answer and unducks.
- `isSpeakingAside: boolean` for the UI.
- The second player uses the same `keepAudioSessionActive: true`.

### `src/data/libraryStore.tsx`: saved Q&A

- New item type `AskedQuestion = { id, bookId, wordIdx, question, answer, title, askedAt }`
  (`askedAt` is an ISO timestamp).
- `askedQuestions`, `addAskedQuestion(q)`, `removeAskedQuestion(id)`.

### `src/data/savedByBook.ts`: grouping Q&A

- `groupQuestionsByBook(books, askedQuestions, currentBookId)`: same book
  ordering as `groupSavedByBook` (current book first, then by title, empty books
  hidden); inside a book, newest first; each item carries its chapter title and
  the few words before `wordIdx` as the passage.

### `src/app/screens/notes.tsx`: tabs

- Segmented control at the top: **Saved** | **Ask DODO**.
- Saved: today's grouped highlights and notes (unchanged).
- Ask DODO: per-book sections with the same header (cover, title, author,
  "N questions"); each card shows the title, the question, the answer, and
  "at “…passage”" with the chapter.

### `src/app/screens/reader.tsx`: wiring

- On the wake word (or mic tap), remember the start of the sentence being read
  (`resumeFromIdx`, via `sentenceAround`).
- `question` commands (and interpreter `answer` results) → "Thinking…" →
  `answerQuestion` → save → success haptic → `speakAside(answer, resumeFromIdx)`
  → status line shows the answer.
- **Mic button, three states:**
  - Idle: tap = same as "Hey DODO" (existing).
  - Listening (after the wake word or a tap): tap ends the user's turn. If
    anything has been said, it's submitted immediately; if not, listening is
    cancelled and the book returns to full volume. The button shows an active
    look while listening.
  - Speaking an answer: tap stops the answer.
- A new "Hey DODO" or pressing play also stops a spoken answer.

### `src/voice/useWakeWord.ts`: ending a turn

- `endTurn()`: if awake, finishes with the command heard so far (`finish(command)`),
  or cancels when nothing was said.
- Exposes `isAwake` (already available as `status === 'awake'`).

## Error handling

| Case | Behavior |
|------|----------|
| Gemini fails or times out (12 s) | Status: "Couldn't answer that right now". Nothing saved, no success haptic, book unducked. |
| Gemini returns an empty answer | Same as a failure. |
| Answer audio fails (ElevenLabs) | Q&A still saved; answer shown in the status line; book unducked. |
| Book longer than the cap | Oldest text dropped; the marker and current sentence always kept. |
| New wake word / mic tap / play during an answer | Answer stops immediately; Q&A stays saved. |
| A non-question classified as a question | Gemini answers briefly; user can delete it from the tab. |

## Testing

**Unit tests:**

- Question detection: question words, trailing `?`, "what does X mean"; and
  commands that must not become questions ("next chapter", "stop",
  "highlight that", "note …").
- `bookSoFar`: ends at the current sentence, includes chapter headings, applies
  the cap keeping the most recent text, ends with the marker.
- `parseAnswer`: rejects empty answers, falls back to a title from the question.
- `groupQuestionsByBook`: ordering, newest first within a book, chapter and
  passage.
- `endTurn` reuses the existing `finish(command)`, which already submits a
  non-empty command and cancels an empty one; it's verified on the phone
  (items 5 and 6) rather than with a new unit test.
- The resume point: the start of the sentence containing the word being read
  at the wake word, including the first sentence of a paragraph.

**On the phone:**

1. While reading, "Hey DODO, why is Alice bored?": book ducks, answer is spoken,
   it appears in Ask DODO.
2. Ask about something from an earlier chapter: the answer connects back to it.
3. Ask how the story ends: no spoilers.
4. Say "Hey DODO" or tap the mic during an answer: it stops.
4a. When an answer ends, narration rewinds to the sentence you were at when you
    asked and continues at full volume.
5. Tap the mic, ask a question, tap again: it's submitted right away.
6. Tap the mic and tap again without speaking: listening cancels, book volume
   returns.
7. Wi-Fi off, ask a question: "Couldn't answer that right now"; book keeps
   playing.
8. Highlights and notes are as fast as before.

## Out of scope

- Typing a question instead of speaking it.
- Follow-up questions that remember the previous answer.
- Saving to the backend (project 3).

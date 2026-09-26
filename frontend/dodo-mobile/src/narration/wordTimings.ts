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

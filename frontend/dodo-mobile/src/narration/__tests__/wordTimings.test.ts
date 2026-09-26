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

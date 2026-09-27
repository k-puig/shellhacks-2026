import { readResult } from '../wakeCommand';

describe('readResult', () => {
  it('finds the command after the wake word', () => {
    expect(readResult(['Hey DODO, pause'], false)).toEqual({ woke: true, command: 'pause' });
  });

  it('wakes with an empty command when only the wake word was said', () => {
    expect(readResult(['hey dodo'], false)).toEqual({ woke: true, command: '' });
  });

  it('uses the first alternative that contains the wake word', () => {
    expect(readResult(['hey toe toe play', 'hey dodo play'], false)).toEqual({
      woke: true,
      command: 'play',
    });
  });

  it('prefers an alternative that also has the command (heard on a real iPhone)', () => {
    expect(readResult([' Hey DODO', ' Hey DODO pause'], true)).toEqual({ woke: true, command: 'pause' });
    expect(readResult(['Hey DODO', 'Hey Dodo'], false)).toEqual({ woke: true, command: '' });
  });

  it('ignores speech without the wake word while asleep', () => {
    expect(readResult([' Play'], false)).toBeNull();
  });

  it('takes a new segment as the command once awake (iOS restarts the transcript after a pause)', () => {
    expect(readResult([' Play'], true)).toEqual({ woke: false, command: 'play' });
  });

  it('ignores an empty segment while awake', () => {
    expect(readResult(['  '], true)).toBeNull();
  });
});

describe('wake word variants heard in noise', () => {
  it.each([
    'hey doe doe pause',
    'hey do-do pause',
    'hey doh doh pause',
    'hey doodoo pause',
    'hey todo pause',
    "hey dodo's pause",
    'Hey. Dodo, pause',
    'okay dodo pause',
  ])('wakes on "%s"', (heard) => {
    expect(readResult([heard], false)).toEqual({ woke: true, command: 'pause' });
  });

  it.each([
    'The Dodo suddenly called out',
    'said the Dodo, and everybody',
    'Hey! said the Dodo',
    'a dodo',
  ])('does not wake on book text "%s"', (heard) => {
    expect(readResult([heard], false)).toBeNull();
  });
});

describe('after tapping the mic button', () => {
  const before = ' Without pictures or conversations';

  it('only counts words said after the tap', () => {
    expect(readResult([`${before} highlight that`], true, before)).toEqual({
      woke: false,
      command: 'highlight that',
    });
  });

  it('takes a fresh segment whole', () => {
    expect(readResult([' Pause'], true, before)).toEqual({ woke: false, command: 'pause' });
  });

  it('waits while nothing new has been said', () => {
    expect(readResult([before], true, before)).toBeNull();
  });
});

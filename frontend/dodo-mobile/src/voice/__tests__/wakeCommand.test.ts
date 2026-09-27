import { readResult } from '../wakeCommand';

describe('readResult', () => {
  it('finds the command after the wake word', () => {
    expect(readResult(['Hey Nova, pause'], false)).toEqual({ woke: true, command: 'pause' });
  });

  it('wakes with an empty command when only the wake word was said', () => {
    expect(readResult(['hey nova'], false)).toEqual({ woke: true, command: '' });
  });

  it('uses the first alternative that contains the wake word', () => {
    expect(readResult(['hey noah play', 'hey nova play'], false)).toEqual({
      woke: true,
      command: 'play',
    });
  });

  it('prefers an alternative that also has the command (heard on a real iPhone)', () => {
    expect(readResult([' Hey Nova', ' Hey Nova pause'], true)).toEqual({ woke: true, command: 'pause' });
    expect(readResult(['Hey Nova', 'Hey nova'], false)).toEqual({ woke: true, command: '' });
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
    'hey no va pause',
    'hey no-va pause',
    'hey novah pause',
    'hey noba pause',
    "hey nova's pause",
    'Hey. Nova, pause',
    'okay nova pause',
    'Hanover pause',
    'hanova pause',
    'Hangover pause',
    'hang over pause',
    'hang-over pause',
    'Anova pause',
    'hay nova pause',
    // The "hey" was dropped (heard with echo cancellation on).
    ' Nova pause',
    'Nova, pause',
    ' A Nova pause',
    'uh nova pause',
    ' No va pause',
  ])('wakes on "%s"', (heard) => {
    expect(readResult([heard], false)).toEqual({ woke: true, command: 'pause' });
  });

  it.each([
    'The nova suddenly flared',
    'said Nova, and everybody',
    'Hey! said Nova',
    'a supernova',
    'Novak walked in',
    'Novels are long',
    'and then Nova smiled',
    'The Dodo suddenly called out',
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

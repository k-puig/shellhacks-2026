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

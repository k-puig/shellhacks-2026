import { onFinish, seekWhenLoaded, type LoadablePlayer } from '../player';

type Update = { isLoaded?: boolean; didJustFinish?: boolean };

// Stands in for expo-audio's player: `isLoaded` is the live native state, and
// emit() delivers a status update the way the native module does, possibly late.
function fakePlayer(isLoaded: boolean) {
  const listeners = new Set<(s: Update) => void>();
  const player = {
    isLoaded,
    seekTo: jest.fn(async (_seconds: number) => {}),
    addListener: (_event: 'playbackStatusUpdate', cb: (s: Update) => void) => {
      listeners.add(cb);
      return { remove: () => listeners.delete(cb) };
    },
    emit: (s: Update) => [...listeners].forEach((l) => l(s)),
  };
  return player;
}

const asPlayer = (p: ReturnType<typeof fakePlayer>) => p as unknown as LoadablePlayer;
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('seekWhenLoaded', () => {
  it('seeks right away when the audio is already loaded', async () => {
    const player = fakePlayer(true);
    await seekWhenLoaded(asPlayer(player), 1.5);
    expect(player.seekTo).toHaveBeenCalledWith(1.5);
  });

  it('waits for the new audio to load before seeking', async () => {
    const player = fakePlayer(false);
    const done = seekWhenLoaded(asPlayer(player), 1.5);
    await flush();
    expect(player.seekTo).not.toHaveBeenCalled();

    player.isLoaded = true;
    player.emit({ isLoaded: true });
    await done;
    expect(player.seekTo).toHaveBeenCalledWith(1.5);
  });

  it('ignores a late update from the previous audio that says it is loaded', async () => {
    const player = fakePlayer(false);
    seekWhenLoaded(asPlayer(player), 1.5);
    player.emit({ isLoaded: true }); // built before replace(); the new audio is not ready
    await flush();
    expect(player.seekTo).not.toHaveBeenCalled();
  });
});

describe('onFinish', () => {
  it('fires even when a "not finished" update follows right after', () => {
    const player = fakePlayer(true);
    const finished = jest.fn();
    onFinish(asPlayer(player), finished);
    player.emit({ didJustFinish: true });
    player.emit({ didJustFinish: false });
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('stops firing once unsubscribed', () => {
    const player = fakePlayer(true);
    const finished = jest.fn();
    const sub = onFinish(asPlayer(player), finished);
    sub.remove();
    player.emit({ didJustFinish: true });
    expect(finished).not.toHaveBeenCalled();
  });
});

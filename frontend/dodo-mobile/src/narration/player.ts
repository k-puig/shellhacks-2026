import type { AudioPlayer } from 'expo-audio';

// The parts of expo-audio's player that narration's timing depends on.
export type LoadablePlayer = Pick<AudioPlayer, 'isLoaded' | 'addListener' | 'seekTo'>;

// Seeks once the player's current audio is ready; a seek before that is ignored.
// Checks the live `player.isLoaded`, not the update's copy: an update built
// before replace() can arrive late and still describe the previous audio.
export async function seekWhenLoaded(player: LoadablePlayer, seconds: number): Promise<void> {
  if (!player.isLoaded) {
    await new Promise<void>((resolve) => {
      const sub = player.addListener('playbackStatusUpdate', () => {
        if (!player.isLoaded) return;
        sub.remove();
        resolve();
      });
    });
  }
  await player.seekTo(seconds);
}

// Calls onDone when the audio plays to the end. Listens to the event itself:
// a "finished" status can be overwritten by the next update before React renders it.
export function onFinish(player: LoadablePlayer, onDone: () => void) {
  return player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) onDone();
  });
}

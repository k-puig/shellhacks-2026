import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Book, Paragraph } from '@/data/mockBooks';

import {
  ElevenLabsError,
  isElevenLabsConfigured,
  MISSING_KEY_MESSAGE,
  synthesize,
} from './elevenlabs';
import { onFinish, seekWhenLoaded } from './player';
import { wordAt } from './wordTimings';

// How often the player reports its position, which drives word highlighting.
const UPDATE_INTERVAL_MS = 100;
// Narrator volume while DODO listens for a command.
const DUCK_VOLUME = 0.2;

const paragraphText = (p: Paragraph) => p.words.map((w) => w.text).join(' ');

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
      }
      // Always wait for the load: a second tap can land while it's in progress.
      await seekWhenLoaded(player, current.wordStarts[offset]);
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
  }, [status.currentTime]);

  // Paragraph finished: continue with the next one, or stop at the end.
  // speakFrom reads refs and the paragraph list, so a stale closure is fine.
  const speakFromRef = useRef(speakFrom);
  useEffect(() => {
    speakFromRef.current = speakFrom;
  });
  useEffect(() => {
    const sub = onFinish(player, () => {
      const current = loaded.current;
      if (!playingRef.current || !current) return;
      const next = paragraphs[paragraphs.indexOf(current.paragraph) + 1];
      if (next) speakFromRef.current(next.words[0].idx);
      else setPlaying(false);
    });
    return () => sub.remove();
  }, [player, paragraphs]);

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

  // Quieter while listening for a command, without stopping the book.
  // Assigning volume is expo-audio's API; it runs in event handlers, not render.
  const duck = () => {
    // eslint-disable-next-line react-hooks/immutability
    player.volume = DUCK_VOLUME;
  };
  const unduck = () => {
    // eslint-disable-next-line react-hooks/immutability
    player.volume = 1;
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
    duck,
    unduck,
  };
}

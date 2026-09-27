import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Book, Paragraph } from '@/data/mockBooks';
import { resumeDelayMs, voiceById } from '@/data/settings';
import { useSettings } from '@/data/settingsStore';

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
  const [error, setError] = useState('');
  // Speed, voice and what happens after an answer come from Settings.
  const { settings, update: updateSettings } = useSettings();

  // keepAudioSessionActive: pausing must not deactivate the iOS audio
  // session, or the always-on "Hey Nova" listener loses the mic.
  const player = useAudioPlayer(null, {
    updateInterval: UPDATE_INTERVAL_MS,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);

  // Second player for DODO's spoken answers, over the ducked narrator.
  const aside = useAudioPlayer(null, { keepAudioSessionActive: true });
  const [isSpeakingAside, setSpeakingAside] = useState(false);
  // Bumped when an answer starts or stops, so a late audio fetch is dropped.
  const asideSession = useRef(0);
  // Where the narrator picks back up when the answer ends.
  const resumeAfterAside = useRef<number | null>(null);
  // The pending "pick the book back up" after an answer; any play/pause wins.
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelResume = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
  };

  // Bumped on every play/pause so results for an abandoned request are ignored.
  const session = useRef(0);
  const currentIdxRef = useRef(0);
  const playingRef = useRef(false);
  const rateRef = useRef(settings.rate);
  const voiceRef = useRef(settings.voiceId);
  const resumeDelayRef = useRef(resumeDelayMs(settings.resumeAfterAnswer));
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
      // Keep reading (and speaking answers) with the screen locked; app.json
      // already declares the "audio" background mode.
      shouldPlayInBackground: true,
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
        const audio = await synthesize(paragraphText(paragraph), voiceRef.current);
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
      if (next) synthesize(paragraphText(next), voiceRef.current).catch(() => {});
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
    cancelResume();
    if (!isElevenLabsConfigured()) {
      setError(MISSING_KEY_MESSAGE);
      return;
    }
    player.pause();
    setPlaying(true);
    speakFrom(fromIdx);
  };

  const pause = () => {
    cancelResume();
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

  // Ends the answer. With `resume`, and if the book was playing, it picks back
  // up a moment later from where the listener asked, at full volume.
  const stopAside = (resume = true) => {
    asideSession.current++;
    aside.pause();
    setSpeakingAside(false);
    unduck();
    const resumeIdx = resumeAfterAside.current;
    resumeAfterAside.current = null;
    if (!resume || resumeIdx === null || !playingRef.current) return;
    const delay = resumeDelayRef.current;
    if (delay === null) {
      // Settings: stay paused after answers, ready at the spot they asked from.
      session.current++;
      moveTo(resumeIdx);
      setPlaying(false);
      return;
    }
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null;
      if (playingRef.current) play(resumeIdx);
    }, delay);
  };

  // Speaks DODO's answer. The book stops while DODO talks (it stays in
  // "playing" mode, so it resumes afterwards).
  const speakAside = async (text: string, resumeFromIdx: number) => {
    cancelResume();
    const mySession = ++asideSession.current;
    resumeAfterAside.current = resumeFromIdx;
    // Also drops a paragraph the narrator was still loading.
    session.current++;
    player.pause();
    setSpeakingAside(true);
    try {
      const audio = await synthesize(text, voiceRef.current);
      if (asideSession.current !== mySession) return;
      aside.replace({ uri: audio.fileUri });
      aside.play();
    } catch (e) {
      if (asideSession.current === mySession) stopAside();
      throw e;
    }
  };

  // The answer played to the end.
  const stopAsideRef = useRef(stopAside);
  useEffect(() => {
    stopAsideRef.current = stopAside;
  });
  useEffect(() => {
    const sub = onFinish(aside, () => stopAsideRef.current());
    return () => sub.remove();
  }, [aside]);

  // "Faster" / "slower" by voice; saved in Settings, which the effect below applies.
  const changeRate = (delta: number) => updateSettings((current) => ({ rate: current.rate + delta }));

  // Apply Settings changes: speed right away, the voice from the next paragraph.
  useEffect(() => {
    rateRef.current = settings.rate;
    player.setPlaybackRate(settings.rate, 'high');
  }, [settings.rate, player]);
  useEffect(() => {
    voiceRef.current = settings.voiceId;
    resumeDelayRef.current = resumeDelayMs(settings.resumeAfterAnswer);
  }, [settings.voiceId, settings.resumeAfterAnswer]);

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
    rate: settings.rate,
    voiceName: voiceById(settings.voiceId).name,
    error,
    play,
    pause,
    seek,
    changeRate,
    duck,
    unduck,
    speakAside,
    stopAside,
    isSpeakingAside,
  };
}

import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Book, Paragraph } from '@/data/mockBooks';

// Best-sounding English voice installed on the device. Premium and Enhanced
// voices are free downloads in Settings → Accessibility → Spoken Content → Voices.
async function pickVoice(): Promise<Speech.Voice | undefined> {
  const voices = await Speech.getAvailableVoicesAsync();
  const score = (v: Speech.Voice) =>
    (v.identifier.includes('.premium.') ? 4 : 0) +
    (v.quality === Speech.VoiceQuality.Enhanced ? 2 : 0) +
    (v.language === 'en-US' ? 1 : 0);
  return voices
    .filter((v) => v.language.startsWith('en'))
    // Skip Apple's novelty ("Bells", "Bad News"…) and robotic Eloquence voices.
    .filter((v) => !/speech\.synthesis|eloquence/.test(v.identifier))
    .sort((a, b) => score(b) - score(a))[0];
}

// Temporary narrator using the device's text-to-speech. It speaks one paragraph
// at a time and reports the global word idx being spoken, which is the same
// contract the Kokoro audio + word timings will fulfil later.
export function useNarration(book: Book) {
  const paragraphs = useMemo(() => book.chapters.flatMap((c) => c.paragraphs), [book]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);

  // Bumped on every play/stop so callbacks from a cancelled utterance are ignored.
  const session = useRef(0);
  const currentIdxRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef<string | undefined>(undefined);
  const [voiceName, setVoiceName] = useState('System default');

  useEffect(() => {
    pickVoice().then((voice) => {
      if (!voice) return;
      voiceRef.current = voice.identifier;
      const tier = voice.identifier.includes('.premium.')
        ? 'Premium'
        : voice.quality === Speech.VoiceQuality.Enhanced
          ? 'Enhanced'
          : '';
      setVoiceName(tier ? `${voice.name} (${tier})` : voice.name);
    });
  }, []);

  const moveTo = (idx: number) => {
    currentIdxRef.current = idx;
    setCurrentIdx(idx);
  };

  const findParagraph = (idx: number): Paragraph | undefined =>
    paragraphs.find((p) => p.words[p.words.length - 1].idx >= idx);

  const speakFrom = (idx: number) => {
    const paragraph = findParagraph(idx);
    if (!paragraph) {
      setIsPlaying(false);
      return;
    }
    const words = paragraph.words.filter((w) => w.idx >= idx);
    const offsets: number[] = [];
    let text = '';
    for (const w of words) {
      offsets.push(text.length);
      text += w.text + ' ';
    }

    const mySession = ++session.current;
    moveTo(words[0].idx);
    Speech.speak(text, {
      rate: rateRef.current,
      voice: voiceRef.current,
      // iOS: share the app's playAndRecord session set up by the voice listener.
      // A separate synthesizer session activates per utterance, which fires
      // route changes that make the listener tear down and reconfigure the
      // session, cutting the narrator out and flipping it to call audio.
      useApplicationAudioSession: true,
      onBoundary: ({ charIndex }: { charIndex: number }) => {
        if (session.current !== mySession) return;
        let i = 0;
        while (i + 1 < offsets.length && offsets[i + 1] <= charIndex) i++;
        moveTo(words[i].idx);
      },
      onDone: () => {
        if (session.current !== mySession) return;
        const next = paragraphs[paragraphs.indexOf(paragraph) + 1];
        if (next) speakFrom(next.words[0].idx);
        else setIsPlaying(false);
      },
    });
  };

  const play = (fromIdx = currentIdxRef.current) => {
    Speech.stop();
    setIsPlaying(true);
    speakFrom(fromIdx);
  };

  const pause = () => {
    session.current++;
    Speech.stop();
    setIsPlaying(false);
  };

  const seek = (idx: number, keepPlaying: boolean) => {
    if (keepPlaying) play(idx);
    else moveTo(idx);
  };

  const changeRate = (delta: number) => {
    const next = Math.min(2, Math.max(0.5, Math.round((rateRef.current + delta) * 10) / 10));
    rateRef.current = next;
    setRate(next);
  };

  useEffect(() => () => {
    session.current++;
    Speech.stop();
  }, []);

  return { paragraphs, currentIdx, currentIdxRef, isPlaying, rate, voiceName, play, pause, seek, changeRate };
}

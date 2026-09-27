import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollViewMarker } from 'react-native-screens/experimental';

import { updateBookProgress } from '@/api/books';
import { isApiConfigured } from '@/api/client';
import { createProgressSync } from '@/api/progressSync';
import { useApi } from '@/api/useApi';
import { useAuth } from '@/auth/AuthProvider';
import { ActionButton, type ActionState } from '@/components/ActionButton';
import { ContentsSheet } from '@/components/ContentsSheet';
import { useLibrary } from '@/data/libraryStore';
import { loadRemoteBookIds } from '@/data/remoteBookIds';
import { useSettings } from '@/data/settingsStore';
import { chapterIndexAt, nextChapterStart, previousChapterTarget } from '@/data/readingProgress';
import type { Book, Highlight, Note, Paragraph } from '@/data/mockBooks';
import { useNarration } from '@/narration/useNarration';
import { colors, HIGHLIGHT_COLORS, withAlpha, type HighlightColorName } from '@/theme';
import {
  interpretCommand,
  isGeminiConfigured,
  recentSentences,
  splitSentences,
} from '@/voice/geminiInterpreter';
import { answerQuestion, resumePoint } from '@/ai/askDodo';
import { isNarratorEcho } from '@/voice/narratorEcho';
import { isBareHighlight, parseCommand, type Command } from '@/voice/parseCommand';
import { useWakeWord } from '@/voice/useWakeWord';

// Height of the floating iOS tab bar above the home-indicator inset.
const TAB_BAR_HEIGHT = 56;
// Room the floating controls take, so the last paragraph can scroll above them.
const DOCK_HEIGHT = 110;
// How far the controls drop while scrolling down, alongside the tab bar
// minimizing; small enough to clear the minimized tab bar pill.
const DOCK_DROP = 40;
// Scroll movement smaller than this doesn't change the controls' position.
const SCROLL_JITTER = 8;
const DOCK_SPRING = { damping: 22, stiffness: 220, reduceMotion: ReduceMotion.System };
// Autoscroll glides for moves this many rows or fewer; farther jumps snap.
const NEARBY_ROWS = 3;
// Answer text stays in the status line this long.
const ANSWER_DISPLAY_MS = 12_000;
// With no touches for this long, only the play button stays on screen.
const IDLE_HIDE_MS = 3000;
const FADE = { duration: 220, reduceMotion: ReduceMotion.System };

// A dock button that fades and shrinks away while the reader is idle.
function IdleFade({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, FADE),
    transform: [{ scale: withTiming(visible ? 1 : 0.85, FADE) }],
  }));
  return (
    <Animated.View style={[styles.sideButton, style]} pointerEvents={visible ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
}

type Saved<T> = T & { bookId: string };
type NoteRange = { note: Saved<Note>; startIdx: number; endIdx: number };

// The reader is a virtualized list of these rows for the chapter being read,
// so only what's near the screen exists even for a full-length book.
type Row =
  | { kind: 'chapter'; key: string; title: string }
  | { kind: 'paragraph'; key: string; paragraph: Paragraph }
  | { kind: 'next'; key: string; title: string };

// One paragraph of words. Memoized: `readUpTo` is -1 before the paragraph is
// reached and Infinity once it's read, so only the paragraph being read
// re-renders as narration moves.
const ParagraphRow = memo(function ParagraphRow({
  paragraph,
  readUpTo,
  highlights,
  notes,
  noteRanges,
  selectedId,
  onWordPress,
  onWordLongPress,
  onNoteMarkPress,
}: {
  paragraph: Paragraph;
  readUpTo: number;
  highlights: Saved<Highlight>[];
  notes: Saved<Note>[];
  noteRanges: NoteRange[];
  selectedId: string | undefined;
  onWordPress: (idx: number) => void;
  onWordLongPress: (paragraph: Paragraph, idx: number) => void;
  onNoteMarkPress: (id: string) => void;
}) {
  const first = paragraph.words[0].idx;
  const last = paragraph.words[paragraph.words.length - 1].idx;
  const mine = <T extends { startIdx: number; endIdx: number }>(xs: T[]) =>
    xs.filter((x) => x.endIdx >= first && x.startIdx <= last);
  const rowHighlights = mine(highlights);
  const rowNoteRanges = mine(noteRanges);
  const rowNotes = notes.filter((n) => n.wordIdx >= first && n.wordIdx <= last);

  return (
    <Text style={styles.paragraph}>
      {paragraph.words.map((w) => {
        const highlight = rowHighlights.find((h) => w.idx >= h.startIdx && w.idx <= h.endIdx);
        const note = rowNotes.find((n) => n.wordIdx === w.idx);
        const noted = rowNoteRanges.find((r) => w.idx >= r.startIdx && w.idx <= r.endIdx)?.note;
        return (
          <Text
            key={w.idx}
            onPress={() => onWordPress(w.idx)}
            onLongPress={() => onWordLongPress(paragraph, w.idx)}
            style={[
              w.idx < readUpTo && styles.spoken,
              highlight && styles.highlighted,
              highlight && { backgroundColor: withAlpha(highlight.color, 0.28) },
              highlight && highlight.id === selectedId && styles.selected,
              noted && styles.noted,
              noted && noted.id === selectedId && styles.notedSelected,
              w.idx === readUpTo && styles.current,
            ]}>
            {w.text}
            {note && (
              <Text
                onPress={() => onNoteMarkPress(note.id)}
                style={[styles.noteMark, note.id === selectedId && styles.noteMarkSelected]}>
                {' '}
                ✎
              </Text>
            )}{' '}
          </Text>
        );
      })}
    </Text>
  );
});

// Book text uses a serif; Georgia ships with iOS, "serif" maps to Noto Serif on Android.
const READING_FONT = Platform.select({ ios: 'Georgia', default: 'serif' });

const endsSentence = (word: string) => /[.!?]["')\]]*$/.test(word);

// The sentence containing a word (used for long-press).
function sentenceContaining(paragraph: Paragraph, idx: number) {
  const words = paragraph.words;
  const at = words.findIndex((w) => w.idx === idx);
  let start = at;
  while (start > 0 && !endsSentence(words[start - 1].text)) start--;
  let end = at;
  while (end < words.length - 1 && !endsSentence(words[end].text)) end++;
  return { startIdx: words[start].idx, endIdx: words[end].idx };
}

// The sentence the listener most likely means by "highlight that": the current
// one, or the previous one if narration has only just started a new sentence.
function sentenceAround(paragraph: Paragraph, idx: number) {
  const current = sentenceContaining(paragraph, idx);
  const wordsIn = idx - current.startIdx;
  if (wordsIn < 3 && current.startIdx > paragraph.words[0].idx) {
    return sentenceContaining(paragraph, current.startIdx - 1);
  }
  return current;
}

export default function ReaderScreen() {
  const { currentBookId, getBook } = useLibrary();
  // Remount per book so narration and voice state start fresh.
  return <Reader key={currentBookId} book={getBook(currentBookId)} />;
}

function Reader({ book }: { book: Book }) {
  const narration = useNarration(book);
  const library = useLibrary();
  const api = useApi();
  const { isAuthenticated, user } = useAuth();
  const subject = user?.sub;
  const { settings, loaded: settingsLoaded } = useSettings();
  const insets = useSafeAreaInsets();
  const highlights = useMemo(
    () => library.highlights.filter((h) => h.bookId === book.id),
    [library.highlights, book.id],
  );
  const notes = useMemo(
    () => library.notes.filter((n) => n.bookId === book.id),
    [library.notes, book.id],
  );

  const [feedback, setFeedback] = useState('');
  // Word the note being typed is attached to; null when the composer is closed.
  const [noteAnchor, setNoteAnchor] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  // A highlight or note the user tapped in the text, so a button can delete it.
  const [selected, setSelected] = useState<{ type: 'highlight' | 'note'; id: string } | null>(null);
  // Set after the first tap on X; the second tap (trash) deletes this item.
  const [confirming, setConfirming] = useState<{ type: 'highlight' | 'note'; id: string } | null>(
    null,
  );
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where narration resumes after an answer: the sentence being read when the
  // listener said "Hey Nova" or tapped the mic.
  const resumeFrom = useRef<number | null>(null);
  // Bumped per question so a slow answer can't play over a newer one.
  const askSession = useRef(0);
  // The answer being spoken, so the mic ignores DODO's own voice too.
  const answerEcho = useRef('');

  // A tap when "Hey Nova" is heard, a success buzz when a command is carried out.
  // (Both off when haptics are turned off in Settings.)
  const buzzWake = () => {
    if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };
  const buzzDone = () => {
    if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const say = (message: string, ms = 2500) => {
    setFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), ms);
  };

  const paragraphOf = (idx: number) =>
    narration.paragraphs.find((p) => p.words[p.words.length - 1].idx >= idx)!;

  const chapterStarts = book.chapters.map((c) => c.paragraphs[0].words[0].idx);

  // Shared by voice, the highlight button, and long-press. Defaults to yellow;
  // asking for a color on an existing highlight recolors it instead of stacking.
  const addHighlight = (
    range: { startIdx: number; endIdx: number },
    colorName: HighlightColorName = settings.highlightColor,
  ) => {
    const color = HIGHLIGHT_COLORS[colorName];
    const existing = highlights.find(
      (h) => h.startIdx === range.startIdx && h.endIdx === range.endIdx,
    );
    if (existing) {
      if (existing.color === color) say('Already highlighted');
      else {
        library.recolorHighlight(existing.id, color);
        say(`Changed to ${colorName}`);
      }
      return;
    }
    library.addHighlight({ bookId: book.id, ...range, color });
    say(colorName === settings.highlightColor ? 'Highlighted' : `Highlighted in ${colorName}`);
  };

  const addNote = (wordIdx: number, content: string) => {
    library.addNote({ bookId: book.id, wordIdx, content });
    say(`Noted: “${content}”`);
  };

  const words = useMemo(() => narration.paragraphs.flatMap((p) => p.words), [narration.paragraphs]);
  const sentences = useMemo(() => splitSentences(narration.paragraphs), [narration.paragraphs]);
  const contextBefore = (idx: number) =>
    words
      .filter((w) => w.idx > idx - 6 && w.idx <= idx)
      .map((w) => w.text)
      .join(' ');

  // Narration keeps playing while the note is typed; it anchors to the word
  // being read when the button was tapped.
  const openNoteComposer = () => {
    setNoteDraft('');
    setNoteAnchor(narration.currentIdxRef.current);
  };

  const saveNote = () => {
    const content = noteDraft.trim();
    if (noteAnchor !== null && content) addNote(noteAnchor, content);
    setNoteAnchor(null);
  };

  // What each button would delete right now. The highlight button also targets
  // the sentence it would highlight, if that sentence is already highlighted.
  const autoHighlight = highlights.find((h) => {
    const range = sentenceAround(paragraphOf(narration.currentIdx), narration.currentIdx);
    return h.startIdx === range.startIdx && h.endIdx === range.endIdx;
  });
  const highlightTarget = selected?.type === 'highlight' ? selected.id : autoHighlight?.id;
  const noteTarget = selected?.type === 'note' ? selected.id : undefined;

  // Trash only shows while the armed item is still this button's target; if the
  // target moves on (narration leaves an auto-targeted sentence), it falls back.
  const isArmed = (type: 'highlight' | 'note', target: string | undefined) =>
    target !== undefined && confirming?.type === type && confirming.id === target;

  const buttonState = (type: 'highlight' | 'note', target: string | undefined): ActionState =>
    isArmed(type, target) ? 'confirm' : target ? 'remove' : 'idle';

  const clearConfirm = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(null);
  };

  // Two-step delete: first tap arms (X → trash), second tap deletes.
  // Unconfirmed deletes fall back to X after a few seconds.
  const pressDelete = (type: 'highlight' | 'note', target: string) => {
    if (isArmed(type, target)) {
      if (type === 'highlight') library.removeHighlight(target);
      else library.removeNote(target);
      clearConfirm();
      setSelected(null);
      say(type === 'highlight' ? 'Highlight removed' : 'Note removed');
      return;
    }
    clearConfirm();
    setConfirming({ type, id: target });
    confirmTimer.current = setTimeout(() => setConfirming(null), 3000);
  };

  const onHighlightButton = () => {
    if (highlightTarget) pressDelete('highlight', highlightTarget);
    else run({ type: 'highlight' });
  };

  const onNoteButton = () => {
    if (noteTarget) pressDelete('note', noteTarget);
    else openNoteComposer();
  };

  // Tapping a highlighted word selects that highlight, tapping underlined
  // (noted) text selects that note; tap again to deselect. Any other word
  // jumps narration there.
  const onWordPress = (idx: number) => {
    const hit = highlights.find((h) => idx >= h.startIdx && idx <= h.endIdx);
    clearConfirm();
    if (hit) {
      setSelected(selected?.id === hit.id ? null : { type: 'highlight', id: hit.id });
      return;
    }
    const noted = noteRanges.find((r) => idx >= r.startIdx && idx <= r.endIdx)?.note;
    if (noted) {
      setSelected(selected?.id === noted.id ? null : { type: 'note', id: noted.id });
      return;
    }
    setSelected(null);
    narration.seek(idx, narration.isPlaying);
  };

  const onNoteMarkPress = (id: string) => {
    clearConfirm();
    setSelected(selected?.id === id ? null : { type: 'note', id });
  };

  // Returns whether narration should resume afterwards.
  const run = (command: Command): boolean => {
    const idx = narration.currentIdxRef.current;
    switch (command.type) {
      case 'pause':
        narration.pause();
        say('Paused');
        break;
      case 'play':
        if (!narration.isPlaying) narration.play();
        say('Playing');
        break;
      case 'highlight':
        addHighlight(sentenceAround(paragraphOf(idx), idx), command.color);
        break;
      case 'note':
        if (!command.content) {
          say('Say "Hey Nova, note…" followed by your note');
          break;
        }
        addNote(idx, command.content);
        break;
      case 'repeat': {
        const p = paragraphOf(idx);
        narration.seek(sentenceAround(p, idx).startIdx, narration.isPlaying);
        say('Going back');
        break;
      }
      case 'skip': {
        const next = narration.paragraphs[narration.paragraphs.indexOf(paragraphOf(idx)) + 1];
        if (next) narration.seek(next.words[0].idx, narration.isPlaying);
        say('Skipping ahead');
        break;
      }
      case 'nextChapter': {
        const next = chapterStarts.find((s) => s > idx);
        if (next === undefined) say('This is the last chapter');
        else {
          narration.seek(next, narration.isPlaying);
          say('Next chapter');
        }
        break;
      }
      case 'previousChapter': {
        const current = chapterStarts.filter((s) => s <= idx).length - 1;
        narration.seek(chapterStarts[Math.max(0, current - 1)], narration.isPlaying);
        say('Previous chapter');
        break;
      }
      case 'faster':
        narration.changeRate(0.1);
        say('Faster');
        break;
      case 'slower':
        narration.changeRate(-0.1);
        say('Slower');
        break;
      case 'unknown':
        say(`Didn't catch that: “${command.heard}”`);
        return false;
      case 'question':
        say('Add EXPO_PUBLIC_GEMINI_API_KEY to ask questions');
        return false;
    }
    return true;
  };

  // Highlight / note / unrecognized commands go to Gemini, which reads the
  // recent sentences and decides exactly what to save. Narration resumes right
  // away; the result lands when Gemini answers. Falls back to the simple rules
  // (sentence just read, note at current word) if the request fails.
  // Ask DODO: Gemini answers from the book so far; the answer is saved, shown,
  // and spoken over the ducked narrator, which then resumes where they asked.
  const ask = (question: string) => {
    const mySession = ++askSession.current;
    const idx = narration.currentIdxRef.current;
    const resume = resumeFrom.current ?? resumePoint(sentences, idx);
    narration.duck();
    setFeedback('Thinking…');

    answerQuestion(question, book, idx)
      .then(({ answer, title }) => {
        if (askSession.current !== mySession) return;
        library.addAskedQuestion({
          bookId: book.id,
          wordIdx: idx,
          question,
          answer,
          title,
          askedAt: new Date().toISOString(),
        });
        buzzDone();
        answerEcho.current = answer;
        say(answer, ANSWER_DISPLAY_MS);
        narration
          .speakAside(answer, resume)
          .catch((error) => console.log('[dodo] Answer audio failed:', String(error)));
      })
      .catch((error) => {
        if (askSession.current !== mySession) return;
        console.log('[dodo] Ask DODO failed:', String(error));
        narration.unduck();
        say("Couldn't answer that right now");
      });
  };

  const understand = (text: string, command: Command) => {
    // A newer "Hey Nova" makes a late "answer" result stale.
    const mySession = askSession.current;
    const idx = narration.currentIdxRef.current;
    const context = recentSentences(sentences, idx);
    setFeedback('Thinking…');

    interpretCommand(text, context, words)
      .then((result) => {
        if (result.action === 'highlight') {
          addHighlight({ startIdx: result.startIdx, endIdx: result.endIdx }, result.color);
          say(result.reply);
          buzzDone();
        } else if (result.action === 'note') {
          library.addNote({ bookId: book.id, wordIdx: result.wordIdx, content: result.content });
          say(result.reply);
          buzzDone();
        } else if (result.action === 'answer') {
          if (askSession.current === mySession) ask(text);
        } else {
          say(result.reply);
        }
      })
      .catch((error) => {
        console.log('[dodo] Gemini failed, using fallback:', String(error));
        if (command.type === 'highlight') {
          addHighlight(sentenceAround(paragraphOf(idx), idx), command.color);
          buzzDone();
        } else if (command.type === 'note' && command.content) {
          addNote(idx, command.content);
          buzzDone();
        } else if (command.type === 'note') say('Say "Hey Nova, note…" followed by your note');
        else say(`Didn't catch that: “${text}”`);
      });
  };

  // The book around the word being read: what the mic hears from the narrator.
  const nearbyNarration = () => {
    const idx = narration.currentIdxRef.current;
    const at = sentences.findIndex((s) => idx >= s.startIdx && idx <= s.endIdx);
    return sentences
      .slice(Math.max(0, at - 2), at + 3)
      .map((s) => s.text)
      .join(' ');
  };

  // The narrator keeps playing while DODO listens, just quieter.
  const voice = useWakeWord({
    onWake: () => {
      buzzWake();
      // A new "Hey Nova" interrupts an answer (the narrator rewinds first).
      askSession.current++;
      // Drop a stale "Thinking…" or previous answer so "Listening…" shows.
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      setFeedback('');
      if (narration.isSpeakingAside) narration.stopAside();
      resumeFrom.current = resumePoint(sentences, narration.currentIdxRef.current);
      narration.duck();
    },
    onCommand: (text) => {
      const command = parseCommand(text);
      // Questions keep the book ducked through the answer.
      if (command.type === 'question' && isGeminiConfigured()) {
        ask(command.text);
        return;
      }
      narration.unduck();
      // "Highlight that" is done here right away; describing what to
      // highlight ("the part about…"), notes, and anything else go to Gemini.
      const needsUnderstanding =
        (command.type === 'highlight' && !isBareHighlight(text)) ||
        command.type === 'note' ||
        command.type === 'unknown';
      if (needsUnderstanding && isGeminiConfigured()) {
        understand(text, command);
        return;
      }
      if (run(command)) buzzDone();
    },
    onCancel: () => {
      narration.unduck();
    },
    // Not until saved settings load, so a saved "off" never briefly turns the mic on.
    alwaysListen: settingsLoaded && settings.wakeWord,
    // "Hey Nova" keeps working with the screen locked while the book is read aloud.
    keepInBackground: narration.isPlaying,
    ignore: (text) =>
      isNarratorEcho(text, nearbyNarration()) || isNarratorEcho(text, answerEcho.current),
  });

  // The reader's list, for autoscrolling to the paragraph being read.
  const scroll = useRef<FlatList<Row>>(null);

  // Controls drop once when scrolling down (as the tab bar minimizes) and stay
  // down: scrolling back up doesn't bounce them, only returning to the top does.
  const lastScrollY = useSharedValue(0);
  const dockDown = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      if (y <= 0) {
        dockDown.value = 0;
        lastScrollY.value = 0;
      } else if (y - lastScrollY.value > SCROLL_JITTER) {
        dockDown.value = 1;
      }
      if (y > 0) lastScrollY.value = Math.min(lastScrollY.value, y);
    },
  });

  // Highlight, mic and note hide after a few seconds without a touch; play
  // stays. They stay up while DODO is listening or something is selected.
  const [touchedRecently, setTouchedRecently] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTouch = () => {
    setTouchedRecently(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setTouchedRecently(false), IDLE_HIDE_MS);
  };
  useEffect(() => {
    idleTimer.current = setTimeout(() => setTouchedRecently(false), IDLE_HIDE_MS);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);
  const showSideButtons =
    touchedRecently || voice.status === 'awake' || narration.isSpeakingAside || selected !== null;
  const dockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(dockDown.value * DOCK_DROP, DOCK_SPRING) }],
  }));
  // One chapter at a time: the one containing the word being read. Jumping
  // anywhere swaps chapters and snaps to the spot, instead of the list
  // estimating its way through thousands of unmeasured paragraphs.
  const shownChapter = chapterIndexAt(book, narration.currentIdx);
  const rows = useMemo<Row[]>(() => {
    const c = book.chapters[shownChapter];
    const next = book.chapters[shownChapter + 1];
    return [
      { kind: 'chapter' as const, key: `c${c.chapterIdx}`, title: c.title },
      ...c.paragraphs.map((p) => ({
        kind: 'paragraph' as const,
        key: `p${p.paragraphIdx}`,
        paragraph: p,
      })),
      ...(next ? [{ kind: 'next' as const, key: 'next', title: next.title }] : []),
    ];
  }, [book, shownChapter]);
  const rowOfParagraph = useMemo(
    () =>
      new Map(
        rows.flatMap((r, i) =>
          r.kind === 'paragraph' ? [[r.paragraph.paragraphIdx, i] as const] : [],
        ),
      ),
    [rows],
  );

  // Keep the paragraph being read on screen, hands-free: glide along with
  // narration, but snap straight there for a jump (chapter, contents, seek),
  // instead of animating through everything in between.
  const activeParagraph = paragraphOf(narration.currentIdx).paragraphIdx;
  const lastScrollRow = useRef<number | null>(null);
  const lastScrollChapter = useRef(shownChapter);
  const scrollAnimated = useRef(false);
  useEffect(() => {
    const index = rowOfParagraph.get(activeParagraph);
    if (index === undefined) return;
    // A new chapter is a fresh list: snap.
    const from = lastScrollChapter.current === shownChapter ? lastScrollRow.current : null;
    lastScrollChapter.current = shownChapter;
    scrollAnimated.current = from !== null && Math.abs(index - from) <= NEARBY_ROWS;
    lastScrollRow.current = index;
    scroll.current?.scrollToIndex({ index, viewPosition: 0.15, animated: scrollAnimated.current });
    // shownChapter always changes together with rowOfParagraph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeParagraph, rowOfParagraph]);

  // Each note underlines the sentence it's attached to.
  const noteRanges = useMemo(
    () =>
      notes.map((n) => ({
        note: n,
        ...sentenceContaining(paragraphOf(n.wordIdx), n.wordIdx),
      })),
    // paragraphOf only reads the book's paragraphs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, narration.paragraphs],
  );

  const onPreviousChapter = () =>
    narration.seek(
      previousChapterTarget(book, narration.currentIdxRef.current),
      narration.isPlaying,
    );
  const onNextChapter = () => {
    const next = nextChapterStart(book, narration.currentIdxRef.current);
    if (next === null) say('This is the last chapter');
    else narration.seek(next, narration.isPlaying);
  };

  // Stable handlers for the memoized rows; the latest versions live in a ref.
  const rowHandlers = useRef({ onWordPress, onNoteMarkPress, addHighlight, onNextChapter: () => {} });
  useEffect(() => {
    rowHandlers.current = { onWordPress, onNoteMarkPress, addHighlight, onNextChapter };
  });
  const onRowWordPress = useCallback((idx: number) => rowHandlers.current.onWordPress(idx), []);
  const onRowWordLongPress = useCallback(
    (paragraph: Paragraph, idx: number) =>
      rowHandlers.current.addHighlight(sentenceContaining(paragraph, idx)),
    [],
  );
  const onRowNoteMarkPress = useCallback(
    (id: string) => rowHandlers.current.onNoteMarkPress(id),
    [],
  );

  const readUpTo = (p: Paragraph) => {
    const current = narration.currentIdx;
    if (current < p.words[0].idx) return -1;
    if (current > p.words[p.words.length - 1].idx) return Infinity;
    return current;
  };

  const renderRow = ({ item }: { item: Row }) =>
    item.kind === 'chapter' ? (
      <Text style={styles.chapterTitle}>{item.title}</Text>
    ) : item.kind === 'next' ? (
      <Pressable
        style={styles.nextChapter}
        onPress={() => rowHandlers.current.onNextChapter()}
        accessibilityRole="button"
        accessibilityLabel={`Next chapter: ${item.title}`}>
        <Text style={styles.nextChapterLabel}>Next chapter</Text>
        <Text style={styles.nextChapterTitle} numberOfLines={2}>
          {item.title} →
        </Text>
      </Pressable>
    ) : (
      <ParagraphRow
        paragraph={item.paragraph}
        readUpTo={readUpTo(item.paragraph)}
        highlights={highlights}
        notes={notes}
        noteRanges={noteRanges}
        selectedId={selected?.id}
        onWordPress={onRowWordPress}
        onWordLongPress={onRowWordLongPress}
        onNoteMarkPress={onRowNoteMarkPress}
      />
    );

  const [showContents, setShowContents] = useState(false);

  // Pick up where the listener left off (paused), once saved positions load.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !library.positionsLoaded) return;
    restored.current = true;
    const saved = library.positions[book.id];
    if (saved) narration.seek(saved.lastIdx, false);
    // Runs once per book, when positions become available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library.positionsLoaded]);

  const progressSync = useRef<ReturnType<typeof createProgressSync> | null>(null);
  const pendingSyncPosition = useRef<number | null>(null);
  const activeAccount = useRef({ isAuthenticated, subject });
  useLayoutEffect(() => {
    activeAccount.current = { isAuthenticated, subject };
  }, [isAuthenticated, subject]);
  useEffect(() => {
    let active = true;
    if (isAuthenticated && subject && isApiConfigured()) {
      void loadRemoteBookIds(subject).then((ids) => {
        const remoteId = ids[book.id];
        if (!active || !remoteId) return;
        const sync = createProgressSync((position) => updateBookProgress(api, remoteId, position));
        progressSync.current = sync;
        if (pendingSyncPosition.current !== null) sync.queue(pendingSyncPosition.current);
      });
    }
    return () => {
      active = false;
      if (activeAccount.current.isAuthenticated && activeAccount.current.subject === subject) {
        progressSync.current?.flush();
      } else {
        progressSync.current?.cancel();
      }
      progressSync.current = null;
      pendingSyncPosition.current = null;
    };
  }, [api, book.id, isAuthenticated, subject]);

  // Save the spot as each paragraph starts and whenever narration pauses.
  // Skipped once after a reset, so moving back to the start isn't saved as progress.
  const skipNextSave = useRef(false);
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (restored.current) {
      const position = narration.currentIdxRef.current;
      library.setPosition(book.id, position);
      pendingSyncPosition.current = position;
      progressSync.current?.queue(position);
    }
    // library.setPosition only updates state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeParagraph, narration.isPlaying]);


  const statusLabel = {
    starting: 'Starting microphone…',
    listening: 'Say “Hey Nova”',
    idle: 'Tap the mic to talk',
    awake: voice.heard ? `“${voice.heard}”` : 'Listening…',
    denied: 'Microphone access denied, enable it in Settings',
    error: `Voice unavailable (${voice.errorDetail}), tap to retry`,
  }[voice.status];

  // Command feedback first, then narration problems, then the mic's state.
  const message = feedback || narration.error;


  // Keep filtering DODO's voice for a moment after it stops talking.
  useEffect(() => {
    if (narration.isSpeakingAside) return;
    const t = setTimeout(() => (answerEcho.current = ''), 2000);
    return () => clearTimeout(t);
  }, [narration.isSpeakingAside]);

  // Mic: idle → listen; listening → end the turn; answering → stop the answer.
  const onMicPress = () => {
    if (narration.isSpeakingAside) narration.stopAside();
    else if (voice.status === 'awake') voice.endTurn();
    else if (voice.status === 'error') voice.retry();
    else voice.wake();
  };
  return (
    <SafeAreaView style={styles.screen} edges={['top']} onTouchStart={onTouch}>
      {/* Tap the title for the table of contents. */}
      <Pressable
        style={styles.titleButton}
        onPress={() => setShowContents(true)}
        accessibilityRole="button"
        accessibilityLabel={`${book.title}, contents`}>
        <Text style={styles.bookTitle} numberOfLines={1}>
          {book.title}
        </Text>
        <SymbolView
          name={{ ios: 'list.bullet', android: 'list', web: 'list' }}
          tintColor={colors.textSecondary}
          size={15}
        />
      </Pressable>

      {/* Turns off iOS 26's blur band under the tab bar so text runs to the bottom edge. */}
      <ScrollViewMarker scrollEdgeEffects={{ bottom: 'hidden' }} style={styles.fill}>
        <Animated.FlatList
          // A fresh list per chapter, starting at its top.
          key={shownChapter}
          ref={scroll}
          data={rows}
          keyExtractor={(row: Row) => row.key}
          renderItem={renderRow}
          // Re-run renderItem as narration moves; memoized rows skip the work.
          extraData={[narration.currentIdx, highlights, notes, noteRanges, selected]}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={11}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            // Rows far away haven't been measured yet: jump near, then settle.
            scroll.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: false,
            });
            setTimeout(
              () =>
                scroll.current?.scrollToIndex({
                  index: info.index,
                  viewPosition: 0.15,
                  animated: scrollAnimated.current,
                }),
              50,
            );
          }}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + DOCK_HEIGHT },
          ]}
        />
      </ScrollViewMarker>

      {/* Floats over the text so the glass controls show the page through them. */}
      <Animated.View
        style={[styles.dock, { bottom: insets.bottom + TAB_BAR_HEIGHT }, dockStyle]}
        pointerEvents="box-none">
        {/* Only shown when there's something to say; idle listening stays silent. */}
        {(message || (voice.status !== 'listening' && voice.status !== 'idle')) && (
          <Pressable
            onPress={voice.status === 'error' ? voice.retry : undefined}
            style={styles.status}>
            <View style={[styles.dot, voice.status === 'awake' && styles.dotAwake]} />
            <Text
              style={[styles.statusText, voice.status === 'awake' && styles.statusTextAwake]}
              numberOfLines={2}>
              {message || statusLabel}
            </Text>
          </Pressable>
        )}

        {/* Play stays at the bottom left; everything else fades when idle. */}
        <View style={styles.controls}>
          <Pressable
            style={styles.playButton}
            accessibilityLabel={narration.isPlaying ? 'Pause' : 'Play'}
            onPress={() => {
              // During an answer: stop it, then do what the button shows.
              if (narration.isSpeakingAside) narration.stopAside(false);
              if (narration.isPlaying) narration.pause();
              else narration.play();
            }}>
            <SymbolView
              name={
                narration.isPlaying
                  ? { ios: 'pause.fill', android: 'pause', web: 'pause' }
                  : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }
              }
              tintColor={colors.background}
              size={26}
            />
          </Pressable>

          <IdleFade visible={showSideButtons}>
            <Pressable
              style={styles.chapterButton}
              hitSlop={6}
              onPress={onPreviousChapter}
              accessibilityRole="button"
              accessibilityLabel="Previous chapter">
              <SymbolView
                name={{ ios: 'backward.end.fill', android: 'skip_previous', web: 'skip_previous' }}
                tintColor={colors.text}
                size={22}
              />
            </Pressable>
          </IdleFade>

          <IdleFade visible={showSideButtons}>
            <Pressable
              style={styles.chapterButton}
              hitSlop={6}
              onPress={onNextChapter}
              accessibilityRole="button"
              accessibilityLabel="Next chapter">
              <SymbolView
                name={{ ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' }}
                tintColor={colors.text}
                size={22}
              />
            </Pressable>
          </IdleFade>

          <IdleFade visible={showSideButtons}>
            <ActionButton
              icon={{ ios: 'highlighter', android: 'ink_highlighter', web: 'ink_highlighter' }}
              state={buttonState('highlight', highlightTarget)}
              onPress={onHighlightButton}
              accessibilityLabel="Highlight the sentence just read"
            />
          </IdleFade>

          {/* Same as saying "Hey Nova", for when the room is too loud. */}
          <IdleFade visible={showSideButtons}>
            <ActionButton
              icon={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
              state="idle"
              onPress={onMicPress}
              active={voice.status === 'awake' || narration.isSpeakingAside}
              accessibilityLabel="Give DODO a voice command"
            />
          </IdleFade>

          <IdleFade visible={showSideButtons}>
            <ActionButton
              icon={{ ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' }}
              state={buttonState('note', noteTarget)}
              onPress={onNoteButton}
              accessibilityLabel="Write a note here"
            />
          </IdleFade>
        </View>
      </Animated.View>

      <ContentsSheet
        visible={showContents}
        book={book}
        position={library.positions[book.id]}
        onClose={() => setShowContents(false)}
        onSelect={(idx) => {
          setShowContents(false);
          narration.seek(idx, narration.isPlaying);
        }}
        onReset={() => {
          setShowContents(false);
          skipNextSave.current = true;
          narration.pause();
          narration.seek(book.chapters[0].paragraphs[0].words[0].idx, false);
          library.clearPosition(book.id);
        }}
      />

      <Modal
        visible={noteAnchor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteAnchor(null)}>
        <KeyboardAvoidingView behavior="padding" style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setNoteAnchor(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>New note</Text>
            {noteAnchor !== null && (
              <Text style={styles.sheetContext} numberOfLines={1}>
                at “…{contextBefore(noteAnchor)}”
              </Text>
            )}
            <TextInput
              style={styles.sheetInput}
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textSecondary}
              multiline
              autoFocus
            />
            <View style={styles.sheetActions}>
              <Pressable style={styles.sheetCancel} onPress={() => setNoteAnchor(null)}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetSave, !noteDraft.trim() && styles.sheetSaveDisabled]}
                disabled={!noteDraft.trim()}
                onPress={saveNote}>
                <Text style={styles.sheetSaveText}>Save note</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  // Minimal header: just the book, quietly centered.
  bookTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingHorizontal: 40,
    paddingTop: 6,
    paddingBottom: 4,
  },
  content: { paddingHorizontal: 26, paddingTop: 28 },
  chapterTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 20,
  },
  paragraph: {
    color: colors.text,
    fontFamily: READING_FONT,
    fontSize: 21,
    lineHeight: 36,
    letterSpacing: 0.1,
    marginBottom: 28,
  },
  // Already-read text dims slightly; still easy to reread.
  spoken: { color: 'rgba(242, 237, 228, 0.62)' },
  // Background comes from each highlight's own color (see withAlpha above).
  highlighted: { color: colors.text },
  // Tapped highlight, ready to delete with the highlight button.
  selected: { backgroundColor: colors.dangerSoft },
  current: { color: colors.accent },
  noteMark: { color: colors.accent, fontSize: 15 },
  noteMarkSelected: { color: colors.danger },
  // Dashed underline on text that has a note (dash style is iOS-only; Android draws solid).
  noted: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dashed',
    textDecorationColor: colors.accent,
  },
  notedSelected: { textDecorationColor: colors.danger },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  statusText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', flexShrink: 1 },
  statusTextAwake: { color: colors.accent },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary },
  dotAwake: { backgroundColor: colors.accent },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  sideButton: { width: 56, alignItems: 'center' },
  nextChapter: {
    marginTop: 28,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    gap: 4,
  },
  nextChapterLabel: { color: colors.textSecondary, fontSize: 13 },
  nextChapterTitle: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  chapterButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 40,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 10,
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  sheetContext: { color: colors.textSecondary, fontSize: 13 },
  sheetInput: {
    minHeight: 96,
    maxHeight: 200,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  sheetCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  sheetCancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '500' },
  sheetSave: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sheetSaveDisabled: { opacity: 0.4 },
  sheetSaveText: { color: colors.background, fontSize: 15, fontWeight: '600' },
});

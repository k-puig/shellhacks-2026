import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
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

import { ActionButton, type ActionState } from '@/components/ActionButton';
import { useLibrary } from '@/data/libraryStore';
import { getBook, type Book, type Paragraph } from '@/data/mockBooks';
import { useNarration } from '@/narration/useNarration';
import { colors, HIGHLIGHT_COLORS, withAlpha, type HighlightColorName } from '@/theme';
import {
  interpretCommand,
  isGeminiConfigured,
  recentSentences,
  splitSentences,
} from '@/voice/geminiInterpreter';
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
  const { currentBookId } = useLibrary();
  // Remount per book so narration and voice state start fresh.
  return <Reader key={currentBookId} book={getBook(currentBookId)} />;
}

function Reader({ book }: { book: Book }) {
  const narration = useNarration(book);
  const library = useLibrary();
  const insets = useSafeAreaInsets();
  const highlights = library.highlights.filter((h) => h.bookId === book.id);
  const notes = library.notes.filter((n) => n.bookId === book.id);

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

  // A tap when "Hey DODO" is heard, a success buzz when a command is carried out.
  const buzzWake = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const buzzDone = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  const say = (message: string) => {
    setFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 2500);
  };

  const paragraphOf = (idx: number) =>
    narration.paragraphs.find((p) => p.words[p.words.length - 1].idx >= idx)!;

  const chapterStarts = book.chapters.map((c) => c.paragraphs[0].words[0].idx);

  // Shared by voice, the highlight button, and long-press. Defaults to yellow;
  // asking for a color on an existing highlight recolors it instead of stacking.
  const addHighlight = (
    range: { startIdx: number; endIdx: number },
    colorName: HighlightColorName = 'yellow',
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
    say(colorName === 'yellow' ? 'Highlighted' : `Highlighted in ${colorName}`);
  };

  const addNote = (wordIdx: number, content: string) => {
    library.addNote({ bookId: book.id, wordIdx, content });
    say(`Noted: “${content}”`);
  };

  const words = narration.paragraphs.flatMap((p) => p.words);
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
          say('Say "Hey DODO, note…" followed by your note');
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
    }
    return true;
  };

  // Highlight / note / unrecognized commands go to Gemini, which reads the
  // recent sentences and decides exactly what to save. Narration resumes right
  // away; the result lands when Gemini answers. Falls back to the simple rules
  // (sentence just read, note at current word) if the request fails.
  const understand = (text: string, command: Command) => {
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
        } else if (command.type === 'note') say('Say "Hey DODO, note…" followed by your note');
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
      narration.duck();
    },
    onCommand: (text) => {
      narration.unduck();
      const command = parseCommand(text);
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
    ignore: (text) => isNarratorEcho(text, nearbyNarration()),
  });

  // Keep the paragraph being read on screen, hands-free.
  const scroll = useRef<Animated.ScrollView>(null);

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
  const showSideButtons = touchedRecently || voice.status === 'awake' || selected !== null;
  const dockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(dockDown.value * DOCK_DROP, DOCK_SPRING) }],
  }));
  // onLayout y is relative to the parent, so keep chapter offsets and paragraph
  // offsets (within their chapter) and add them to get a scroll position.
  const chapterY = useRef<Record<number, number>>({});
  const paragraphY = useRef<Record<number, { chapterIdx: number; y: number }>>({});
  const activeParagraph = paragraphOf(narration.currentIdx).paragraphIdx;
  useEffect(() => {
    const entry = paragraphY.current[activeParagraph];
    if (!entry) return;
    const y = (chapterY.current[entry.chapterIdx] ?? 0) + entry.y;
    scroll.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
  }, [activeParagraph]);

  const highlightAt = (idx: number) => highlights.find((h) => idx >= h.startIdx && idx <= h.endIdx);
  const noteAt = (idx: number) => notes.find((n) => n.wordIdx === idx);
  // Each note underlines the sentence it's attached to.
  const noteRanges = notes.map((n) => ({
    note: n,
    ...sentenceContaining(paragraphOf(n.wordIdx), n.wordIdx),
  }));
  const notedAt = (idx: number) =>
    noteRanges.find((r) => idx >= r.startIdx && idx <= r.endIdx)?.note;

  const statusLabel = {
    starting: 'Starting microphone…',
    listening: 'Say “Hey DODO”',
    awake: voice.heard ? `“${voice.heard}”` : 'Listening…',
    denied: 'Microphone access denied, enable it in Settings',
    error: `Voice unavailable (${voice.errorDetail}), tap to retry`,
  }[voice.status];

  // Command feedback first, then narration problems, then the mic's state.
  const message = feedback || narration.error;

  return (
    <SafeAreaView style={styles.screen} edges={['top']} onTouchStart={onTouch}>
      <Text style={styles.bookTitle} numberOfLines={1}>
        {book.title}
      </Text>

      {/* Turns off iOS 26's blur band under the tab bar so text runs to the bottom edge. */}
      <ScrollViewMarker scrollEdgeEffects={{ bottom: 'hidden' }} style={styles.fill}>
        <Animated.ScrollView
          ref={scroll}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + DOCK_HEIGHT },
          ]}>
          {book.chapters.map((chapter) => (
            <View
              key={chapter.chapterIdx}
              onLayout={(e) => (chapterY.current[chapter.chapterIdx] = e.nativeEvent.layout.y)}>
              <Text style={styles.chapterTitle}>{chapter.title}</Text>
              {chapter.paragraphs.map((p) => (
                <Text
                  key={p.paragraphIdx}
                  style={styles.paragraph}
                  onLayout={(e) =>
                    (paragraphY.current[p.paragraphIdx] = {
                      chapterIdx: chapter.chapterIdx,
                      y: e.nativeEvent.layout.y,
                    })
                  }>
                  {p.words.map((w) => {
                    const highlight = highlightAt(w.idx);
                    const note = noteAt(w.idx);
                    const noted = notedAt(w.idx);
                    return (
                      <Text
                        key={w.idx}
                        onPress={() => onWordPress(w.idx)}
                        onLongPress={() => addHighlight(sentenceContaining(p, w.idx))}
                        style={[
                          w.idx < narration.currentIdx && styles.spoken,
                          highlight && styles.highlighted,
                          highlight && { backgroundColor: withAlpha(highlight.color, 0.28) },
                          highlight && highlight.id === selected?.id && styles.selected,
                          noted && styles.noted,
                          noted && noted.id === selected?.id && styles.notedSelected,
                          w.idx === narration.currentIdx && styles.current,
                        ]}>
                        {w.text}
                        {note && (
                          <Text
                            onPress={() => onNoteMarkPress(note.id)}
                            style={[
                              styles.noteMark,
                              note.id === selected?.id && styles.noteMarkSelected,
                            ]}>
                            {' '}
                            ✎
                          </Text>
                        )}{' '}
                      </Text>
                    );
                  })}
                </Text>
              ))}
            </View>
          ))}
        </Animated.ScrollView>
      </ScrollViewMarker>

      {/* Floats over the text so the glass controls show the page through them. */}
      <Animated.View
        style={[styles.dock, { bottom: insets.bottom + TAB_BAR_HEIGHT }, dockStyle]}
        pointerEvents="box-none">
        {/* Only shown when there's something to say; idle listening stays silent. */}
        {(message || voice.status !== 'listening') && (
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

        <View style={styles.controls}>
          <Pressable
            style={styles.playButton}
            accessibilityLabel={narration.isPlaying ? 'Pause' : 'Play'}
            onPress={() => (narration.isPlaying ? narration.pause() : narration.play())}>
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
            <ActionButton
              icon={{ ios: 'highlighter', android: 'ink_highlighter', web: 'ink_highlighter' }}
              state={buttonState('highlight', highlightTarget)}
              onPress={onHighlightButton}
              accessibilityLabel="Highlight the sentence just read"
            />
          </IdleFade>

          {/* Same as saying "Hey DODO", for when the room is too loud. */}
          <IdleFade visible={showSideButtons}>
            <ActionButton
              icon={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
              state="idle"
              onPress={voice.status === 'error' ? voice.retry : voice.wake}
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
  sideButton: { width: 88, alignItems: 'center' },
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

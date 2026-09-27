import { useAudioPlayer } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { onFinish } from '@/narration/player';
import { synthesize } from '@/narration/elevenlabs';
import { VOICES } from '@/data/settings';
import { colors } from '@/theme';

const sample = (name: string) => `Hi, I'm ${name}. I'd love to read to you.`;

// Choose the ElevenLabs narrator voice. ▶ plays a one-line sample (a few
// credits the first time; cached after that).
export function VoicePicker({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string;
  onSelect: (voiceId: string) => void;
  onClose: () => void;
}) {
  const player = useAudioPlayer(null, { keepAudioSessionActive: true });
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Only the latest tap may play; closing or tapping again bumps it.
  const previewSession = useRef(0);
  const finishSub = useRef<{ remove: () => void } | null>(null);

  const stopPreview = () => {
    previewSession.current++;
    finishSub.current?.remove();
    finishSub.current = null;
    player.pause();
    setPreviewing(null);
    setLoading(null);
  };

  const preview = async (voiceId: string, name: string) => {
    if (previewing === voiceId) return stopPreview();
    stopPreview();
    const mySession = previewSession.current;
    setLoading(voiceId);
    try {
      const audio = await synthesize(sample(name), voiceId);
      if (previewSession.current !== mySession) return;
      player.replace({ uri: audio.fileUri });
      player.play();
      setPreviewing(voiceId);
      finishSub.current = onFinish(player, () => {
        finishSub.current?.remove();
        finishSub.current = null;
        setPreviewing(null);
      });
    } catch (error) {
      console.log('[dodo] Voice preview failed:', String(error));
    } finally {
      if (previewSession.current === mySession) setLoading(null);
    }
  };

  const close = () => {
    stopPreview();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.heading}>Voice</Text>
          <Pressable hitSlop={10} onPress={close} accessibilityRole="button">
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Narration by ElevenLabs. Changes apply from the next paragraph.</Text>

        <ScrollView contentContainerStyle={styles.list}>
          {VOICES.map((voice, i) => {
            const selected = voice.id === selectedId;
            return (
              <Pressable
                key={voice.id}
                style={[styles.row, i > 0 && styles.rowDivider]}
                onPress={() => onSelect(voice.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${voice.name}, ${voice.description}`}>
                <View style={styles.rowText}>
                  <Text style={[styles.name, selected && styles.nameSelected]}>{voice.name}</Text>
                  <Text style={styles.description}>{voice.description}</Text>
                </View>
                {selected && (
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    tintColor={colors.accent}
                    size={17}
                  />
                )}
                <Pressable
                  style={styles.preview}
                  hitSlop={6}
                  onPress={() => preview(voice.id, voice.name)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    previewing === voice.id ? `Stop ${voice.name} sample` : `Play ${voice.name} sample`
                  }>
                  {loading === voice.id ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <SymbolView
                      name={
                        previewing === voice.id
                          ? { ios: 'stop.fill', android: 'stop', web: 'stop' }
                          : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }
                      }
                      tintColor={colors.accent}
                      size={14}
                    />
                  )}
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heading: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  done: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  hint: { color: colors.textSecondary, fontSize: 14, paddingHorizontal: 20, marginTop: 6, marginBottom: 16 },
  list: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  nameSelected: { color: colors.accent },
  description: { color: colors.textSecondary, fontSize: 13 },
  preview: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

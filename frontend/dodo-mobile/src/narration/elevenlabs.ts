import { File, Paths } from 'expo-file-system';

import { wordStartTimes } from './wordTimings';

// ElevenLabs text-to-speech for narration. The key is read from
// EXPO_PUBLIC_ELEVENLABS_API_KEY (.env.local). EXPO_PUBLIC_ vars are bundled
// into the app: fine for the hackathon demo, but move this call to the backend
// before shipping.

const API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
// Defaults to "Rachel", one of ElevenLabs' built-in voices.
const VOICE_ID = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDQ8ikWAM';
const MODEL = 'eleven_flash_v2_5';
const TIMEOUT_MS = 15_000;

export const MISSING_KEY_MESSAGE = 'Add EXPO_PUBLIC_ELEVENLABS_API_KEY to .env.local';

export const isElevenLabsConfigured = () => Boolean(API_KEY);

export type Narration = { fileUri: string; wordStarts: number[] };

// Its message is shown to the user as is.
export class ElevenLabsError extends Error {}

export function errorMessage(status: number, detailStatus?: string): string {
  if (detailStatus === 'quota_exceeded' || status === 429) return 'ElevenLabs: out of credits';
  // Keys can be restricted per feature in the ElevenLabs dashboard.
  if (detailStatus === 'missing_permissions') {
    return 'ElevenLabs: key needs the Text to Speech permission';
  }
  if (status === 401) return 'ElevenLabs: invalid API key';
  return `ElevenLabs: error ${status}`;
}

type WithTimestamps = {
  audio_base64: string;
  alignment: { characters: string[]; character_start_times_seconds: number[] };
};

// One entry per paragraph text, so replaying or seeking back costs no credits.
// Failed requests are dropped so pressing play again retries them.
const cache = new Map<string, Promise<Narration>>();
let fileCount = 0;

export function synthesize(text: string): Promise<Narration> {
  let request = cache.get(text);
  if (!request) {
    request = fetchNarration(text);
    cache.set(text, request);
    request.catch(() => cache.delete(text));
  }
  return request;
}

async function fetchNarration(text: string): Promise<Narration> {
  if (!API_KEY) throw new ElevenLabsError(MISSING_KEY_MESSAGE);

  // One deadline for the whole exchange, including downloading the audio,
  // which can stall on a flaky connection after the headers arrive.
  const connectError = () => new ElevenLabsError("ElevenLabs: couldn't connect");
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(connectError());
    }, TIMEOUT_MS);
  });
  deadline.catch(() => {});

  let json: WithTimestamps;
  try {
    let res: Response;
    try {
      res = await Promise.race([
        fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`, {
          method: 'POST',
          headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, model_id: MODEL }),
          signal: controller.signal,
        }),
        deadline,
      ]);
    } catch {
      throw connectError();
    }

    if (!res.ok) {
      const body = await Promise.race([res.json(), deadline]).catch(() => null);
      console.log('[dodo] ElevenLabs error', res.status, JSON.stringify(body));
      throw new ElevenLabsError(errorMessage(res.status, body?.detail?.status));
    }

    json = await Promise.race([res.json() as Promise<WithTimestamps>, deadline]).catch(() => {
      throw connectError();
    });
  } finally {
    clearTimeout(timeout);
  }

  const file = new File(Paths.cache, `narration-${Date.now()}-${fileCount++}.mp3`);
  file.create({ overwrite: true });
  file.write(json.audio_base64, { encoding: 'base64' });

  return {
    fileUri: file.uri,
    wordStarts: wordStartTimes(
      text,
      json.alignment.characters,
      json.alignment.character_start_times_seconds,
    ),
  };
}

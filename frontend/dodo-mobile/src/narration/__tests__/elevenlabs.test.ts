import { errorMessage } from '../elevenlabs';

// The client writes audio files; the error mapping under test never does.
// (Jest hoists this above the import.)
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri = 'file:///narration.mp3';
    create() {}
    write() {}
  },
}));

describe('errorMessage', () => {
  it('reports a bad key', () => {
    expect(errorMessage(401)).toBe('ElevenLabs: invalid API key');
  });

  it('reports running out of credits, which ElevenLabs sends as a 401', () => {
    expect(errorMessage(401, 'quota_exceeded')).toBe('ElevenLabs: out of credits');
  });

  it('says which permission is missing when the key is restricted', () => {
    expect(errorMessage(401, 'missing_permissions')).toBe(
      'ElevenLabs: key needs the Text to Speech permission',
    );
  });

  it('points at the voice setting when the voice does not exist', () => {
    expect(errorMessage(404, 'voice_not_found')).toBe(
      'ElevenLabs: voice not found, check EXPO_PUBLIC_ELEVENLABS_VOICE_ID',
    );
  });

  it('reports rate limiting as out of credits', () => {
    expect(errorMessage(429)).toBe('ElevenLabs: out of credits');
  });

  it('reports anything else with its status', () => {
    expect(errorMessage(500)).toBe('ElevenLabs: error 500');
  });
});

describe('synthesize', () => {
  afterEach(() => jest.useRealTimers());

  it("gives up with couldn't connect when the audio download stalls", async () => {
    jest.useFakeTimers();
    process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY = 'test-key';
    // Headers arrive, then the body never finishes downloading.
    globalThis.fetch = jest.fn(async () => ({ ok: true, json: () => new Promise(() => {}) })) as never;
    let synthesize!: typeof import('../elevenlabs').synthesize;
    // Fresh copy so it reads the key set above.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      synthesize = require('../elevenlabs').synthesize;
    });

    const result = synthesize('a paragraph whose download stalls');
    const assertion = expect(result).rejects.toThrow("ElevenLabs: couldn't connect");
    await jest.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});

describe('synthesize with a voice', () => {
  it('fetches each voice separately and caches per voice', async () => {
    process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY = 'test-key';
    const fetchMock = jest.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({
        audio_base64: '',
        alignment: { characters: ['H', 'i'], character_start_times_seconds: [0, 0.1] },
      }),
    }));
    globalThis.fetch = fetchMock as never;
    let synthesize!: typeof import('../elevenlabs').synthesize;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      synthesize = require('../elevenlabs').synthesize;
    });

    await synthesize('Hi', 'voice-a');
    await synthesize('Hi', 'voice-b');
    await synthesize('Hi', 'voice-a');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/voice-a/');
    expect(fetchMock.mock.calls[1][0]).toContain('/voice-b/');
  });
});

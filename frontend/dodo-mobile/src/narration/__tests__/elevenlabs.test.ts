import { errorMessage } from '../elevenlabs';

// The client writes audio files; the error mapping under test never does.
// (Jest hoists this above the import.)
jest.mock('expo-file-system', () => ({}));

describe('errorMessage', () => {
  it('reports a bad key', () => {
    expect(errorMessage(401)).toBe('ElevenLabs: invalid API key');
  });

  it('reports running out of credits, which ElevenLabs sends as a 401', () => {
    expect(errorMessage(401, 'quota_exceeded')).toBe('ElevenLabs: out of credits');
  });

  it('reports rate limiting as out of credits', () => {
    expect(errorMessage(429)).toBe('ElevenLabs: out of credits');
  });

  it('reports anything else with its status', () => {
    expect(errorMessage(500)).toBe('ElevenLabs: error 500');
  });
});

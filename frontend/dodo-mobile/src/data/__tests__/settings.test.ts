import {
  clampRate,
  DEFAULT_SETTINGS,
  parseSettings,
  resumeDelayMs,
  VOICES,
  voiceById,
} from '../settings';

describe('parseSettings', () => {
  it('uses the defaults when nothing is saved', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('ignores a corrupted file', () => {
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid saved choices', () => {
    const saved = {
      voiceId: VOICES[1].id,
      rate: 1.3,
      resumeAfterAnswer: 'off',
      wakeWord: false,
      haptics: false,
      highlightColor: 'blue',
    };
    expect(parseSettings(JSON.stringify(saved))).toEqual(saved);
  });

  it('replaces invalid values with the defaults, field by field', () => {
    const parsed = parseSettings(
      JSON.stringify({ rate: 'fast', resumeAfterAnswer: 'soon', highlightColor: 'teal', haptics: false }),
    );
    expect(parsed).toEqual({ ...DEFAULT_SETTINGS, haptics: false });
  });

  it('keeps speed within limits', () => {
    expect(parseSettings(JSON.stringify({ rate: 9 })).rate).toBe(2);
  });
});

describe('clampRate', () => {
  it('keeps speed between 0.5x and 2x in 0.1 steps', () => {
    expect(clampRate(0.3)).toBe(0.5);
    expect(clampRate(2.4)).toBe(2);
    expect(clampRate(1.26)).toBe(1.3);
  });
});

describe('resumeDelayMs', () => {
  it('maps the choice to a delay, or null for off', () => {
    expect(resumeDelayMs('short')).toBe(1000);
    expect(resumeDelayMs('normal')).toBe(2000);
    expect(resumeDelayMs('off')).toBeNull();
  });
});

describe('voiceById', () => {
  it('finds a curated voice', () => {
    expect(voiceById(VOICES[0].id)).toBe(VOICES[0]);
  });

  it('describes a voice set outside the list', () => {
    expect(voiceById('custom-id')).toEqual({ id: 'custom-id', name: 'Custom voice', description: '' });
  });
});

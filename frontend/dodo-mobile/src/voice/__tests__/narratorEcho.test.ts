import { isNarratorEcho } from '../narratorEcho';

const book =
  'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.';

describe('isNarratorEcho', () => {
  it('flags the narrator reading the book', () => {
    expect(isNarratorEcho('beginning to get very tired of sitting by her sister', book)).toBe(true);
  });

  it('flags the narrator even with a misheard word', () => {
    expect(isNarratorEcho('tired of sitting by her system on the bank', book)).toBe(true);
  });

  it('lets through a command that mentions words from the book', () => {
    expect(isNarratorEcho('highlight the part about her sister', book)).toBe(false);
  });

  it('lets through a one-word command', () => {
    expect(isNarratorEcho('pause', 'Pause for a moment, she said.')).toBe(false);
  });

  it('ignores punctuation and case', () => {
    expect(isNarratorEcho('ALICE WAS BEGINNING, TO GET', book)).toBe(true);
  });

  it('lets through empty text', () => {
    expect(isNarratorEcho('  ', book)).toBe(false);
  });
});

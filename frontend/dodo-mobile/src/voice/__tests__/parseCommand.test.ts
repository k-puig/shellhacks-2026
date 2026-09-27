import { isBareHighlight, isInstantCommand, parseCommand } from '../parseCommand';

const instant = (text: string) => isInstantCommand(parseCommand(text));

describe('isInstantCommand', () => {
  it.each(['pause', 'stop', 'play', 'resume', 'faster', 'slower', 'next chapter', 'previous chapter'])(
    'runs "%s" right away',
    (text) => expect(instant(text)).toBe(true),
  );

  it('waits on "next", which may still become "next chapter"', () => {
    expect(instant('next')).toBe(false);
  });

  it('waits on highlights, which may still name a color', () => {
    expect(instant('highlight that')).toBe(false);
  });

  it('waits on notes, which are still being dictated', () => {
    expect(instant('note this is important')).toBe(false);
  });

  it('waits on anything it does not recognize', () => {
    expect(instant('what does this word mean')).toBe(false);
  });
});

describe('isBareHighlight', () => {
  it.each(['highlight', 'highlight that', 'Highlight this.', 'highlight it please', 'mark that'])(
    'handles "%s" on the phone',
    (text) => expect(isBareHighlight(text)).toBe(true),
  );

  it.each([
    'highlight the part about the rabbit',
    'highlight that in blue',
    'highlight the last two sentences',
  ])('sends "%s" to Gemini', (text) => expect(isBareHighlight(text)).toBe(false));
});

describe('questions', () => {
  it.each([
    'why did the rabbit stop',
    'what happens next',
    'who is that again',
    'what does countenance mean',
    'explain this part',
    'can you explain the tea party',
    'tell me about the Duchess',
    'is the duchess the queen?',
    'she was late?',
  ])('treats "%s" as a question', (text) => {
    expect(parseCommand(text)).toEqual({ type: 'question', text });
  });

  it.each([
    ['stop', 'pause'],
    ['next chapter', 'nextChapter'],
    ["what's the next chapter", 'nextChapter'],
    ['can you pause', 'pause'],
    ['keep going', 'play'],
    ['highlight the part about the rabbit', 'highlight'],
    ['note why she left', 'note'],
  ])('keeps "%s" as the %s command', (text, type) => {
    expect(parseCommand(text).type).toBe(type);
  });
});

describe('chapter recap questions', () => {
  it.each([
    'what happened in the last chapter',
    'remind me what happened in the previous chapter',
    'can you recap the last chapter',
  ])('answers "%s" instead of changing chapter', (text) => {
    expect(parseCommand(text)).toEqual({ type: 'question', text });
  });

  it.each([
    ['next chapter', 'nextChapter'],
    ['go to the previous chapter', 'previousChapter'],
    ["what's the next chapter", 'nextChapter'],
  ])('still navigates on "%s"', (text, type) => {
    expect(parseCommand(text).type).toBe(type);
  });
});

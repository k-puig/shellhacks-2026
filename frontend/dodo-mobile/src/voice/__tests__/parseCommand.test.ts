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

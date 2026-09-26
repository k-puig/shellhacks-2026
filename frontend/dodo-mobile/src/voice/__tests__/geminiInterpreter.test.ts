import { recentSentences, type Sentence } from '../geminiInterpreter';

// Sentence n covers words 10n..10n+9.
const sentences: Sentence[] = Array.from({ length: 30 }, (_, n) => ({
  id: `s${n}`,
  startIdx: n * 10,
  endIdx: n * 10 + 9,
  text: `Sentence ${n}.`,
}));

describe('recentSentences', () => {
  it('gives Gemini the last 10 sentences, ending with the one being read', () => {
    const recent = recentSentences(sentences, 205); // inside s20
    expect(recent.map((s) => s.id)).toEqual(
      ['s11', 's12', 's13', 's14', 's15', 's16', 's17', 's18', 's19', 's20'],
    );
  });

  it('gives fewer near the start of the book', () => {
    expect(recentSentences(sentences, 25).map((s) => s.id)).toEqual(['s0', 's1', 's2']);
  });
});

describe('interpretCommand', () => {
  it('hands questions about the book on to be answered', async () => {
    process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'test-key';
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: JSON.stringify({ action: 'answer', reply: 'Good question' }) }] } },
        ],
      }),
    })) as never;
    let interpretCommand!: typeof import('../geminiInterpreter').interpretCommand;
    // Fresh copy so it reads the key set above.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      interpretCommand = require('../geminiInterpreter').interpretCommand;
    });

    const result = await interpretCommand('what is going on with her', sentences.slice(0, 3), []);
    expect(result).toEqual({ action: 'answer', reply: 'Good question' });
  });
});

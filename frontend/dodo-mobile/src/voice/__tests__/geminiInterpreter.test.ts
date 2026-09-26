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

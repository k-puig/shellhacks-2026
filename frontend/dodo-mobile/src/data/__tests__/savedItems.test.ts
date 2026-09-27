import { emptySavedItems, parseSavedItems, type SavedItems } from '../savedItems';

const items: SavedItems = {
  highlights: [{ id: 'h1', bookId: 'b', startIdx: 3, endIdx: 9, color: '#E3A548' }],
  notes: [{ id: 'n1', bookId: 'b', wordIdx: 12, content: 'Remember this for the essay' }],
  askedQuestions: [
    {
      id: 'q1',
      bookId: 'b',
      wordIdx: 20,
      question: 'Why is the Rabbit late?',
      answer: 'He is due at the Duchess.',
      title: 'Why the Rabbit is late',
      askedAt: '2026-09-27T08:00:00.000Z',
    },
  ],
};

describe('parseSavedItems', () => {
  it('reads back what was saved', () => {
    expect(parseSavedItems(JSON.stringify(items))).toEqual(items);
  });

  it('treats a missing file as nothing saved', () => {
    expect(parseSavedItems(null)).toEqual(emptySavedItems());
  });

  it('ignores a corrupted file', () => {
    expect(parseSavedItems('{not json')).toEqual(emptySavedItems());
    expect(parseSavedItems('42')).toEqual(emptySavedItems());
  });

  it('drops malformed entries and keeps the rest', () => {
    const json = JSON.stringify({
      highlights: [{ id: 'h0', bookId: 'b', startIdx: '3', endIdx: 9, color: 'red' }, ...items.highlights],
      notes: [null, ...items.notes],
      askedQuestions: items.askedQuestions,
    });
    expect(parseSavedItems(json)).toEqual(items);
  });

  it('treats a missing list as empty', () => {
    expect(parseSavedItems(JSON.stringify({ notes: items.notes }))).toEqual({
      ...emptySavedItems(),
      notes: items.notes,
    });
  });
});

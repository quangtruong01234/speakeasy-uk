import { describe, expect, it } from 'vitest';
import type { DB } from '../shared/types';
import { importWords } from '../server/importer';
import { DEFAULT_SETTINGS, makeItem } from '../server/store';

function db(): DB {
  const topic = { id: 'food', name: 'Food & Drink', emoji: '🍽️', createdAt: '2026-11-01T00:00:00Z' };
  return { version: 1, topics: [topic], items: [makeItem('food', 'Fancy a cuppa?')], logs: [], settings: DEFAULT_SETTINGS };
}

const full = {
  text: 'Could I have the bill, please?',
  ipa: 'kʊd aɪ hæv ðə bɪl pliːz',
  meaningVi: 'Cho tôi xin hoá đơn nhé?',
  examples: [{ en: 'Could I have the bill, please? We are in a bit of a rush.', vi: 'Cho tôi xin hoá đơn nhé, chúng tôi hơi vội.' }],
};

describe('importWords', () => {
  it('adds to an existing topic matched by name and skips duplicates', () => {
    const data = db();
    const [report] = importWords(data, { topic: { name: 'food & drink' }, items: [full, 'fancy a cuppa'] });
    expect(report).toMatchObject({ topicId: 'food', created: false, added: [full.text], skipped: ['fancy a cuppa'], incomplete: [] });
    expect(data.items.at(-1)).toMatchObject({ topicId: 'food', ipa: '/kʊd aɪ hæv ðə bɪl pliːz/', srs: null });
  });

  it('creates a missing topic and flags items without examples', () => {
    const data = db();
    const [report] = importWords(data, { topic: { name: 'At the GP', emoji: '🏥' }, items: ['I’ve got a sore throat'] });
    expect(report.created).toBe(true);
    expect(data.topics).toHaveLength(2);
    expect(data.topics[1]).toMatchObject({ name: 'At the GP', emoji: '🏥' });
    expect(report.incomplete).toEqual(['I’ve got a sore throat']);
  });

  it('accepts several batches and a topicId', () => {
    const data = db();
    const reports = importWords(data, [
      { topicId: 'food', items: ['Takeaway'] },
      { topic: { name: 'Travel' }, items: ['Mind the gap'] },
    ]);
    expect(reports.map((r) => r.added)).toEqual([['Takeaway'], ['Mind the gap']]);
  });

  it('rejects an unknown topicId or a batch without items', () => {
    expect(() => importWords(db(), { topicId: 'nope', items: [] })).toThrow('nope');
    expect(() => importWords(db(), { topic: { name: 'X' } })).toThrow('items');
  });
});

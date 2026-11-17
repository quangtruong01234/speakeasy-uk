import { describe, expect, it } from 'vitest';
import type { DB, Item, ReviewLog } from '../shared/types';
import { buildQueue, computeStats, humanInterval, isComplete, schedule, summariseTopics } from '../server/srs';

const NOW = new Date('2026-11-17T10:00:00');

function item(id: string, extra: Partial<Item> = {}): Item {
  return {
    id,
    topicId: 't1',
    text: `phrase ${id}`,
    kind: 'phrase',
    meaningVi: 'nghĩa',
    examples: [{ en: 'An example.', vi: 'Một ví dụ.' }],
    createdAt: `2026-11-01T00:00:${id.padStart(2, '0')}Z`,
    srs: null,
    ...extra,
  };
}

function db(items: Item[], logs: ReviewLog[] = [], newPerDay = 3): DB {
  return {
    version: 1,
    topics: [
      { id: 't1', name: 'One', emoji: '📘', createdAt: '2026-11-01T00:00:00Z' },
      { id: 't2', name: 'Two', emoji: '📘', createdAt: '2026-11-01T00:00:00Z' },
    ],
    items,
    logs,
    settings: { voice: 'en-GB-SoniaNeural', rate: 1, model: 'sonnet', newPerDay, level: 'B1' },
  };
}

const due = (offsetMs: number) => schedule(null, 3, new Date(NOW.getTime() - 7 * 86_400_000 + offsetMs));

describe('isComplete', () => {
  it('needs a meaning and at least one example', () => {
    expect(isComplete(item('1'))).toBe(true);
    expect(isComplete(item('2', { meaningVi: undefined }))).toBe(false);
    expect(isComplete(item('3', { examples: [] }))).toBe(false);
  });
});

describe('schedule', () => {
  it('pushes Easy further out than Again', () => {
    const again = schedule(null, 1, NOW);
    const easy = schedule(null, 4, NOW);
    expect(new Date(easy.due).getTime()).toBeGreaterThan(new Date(again.due).getTime());
    expect(easy.reps).toBe(1);
  });
});

describe('humanInterval', () => {
  it('formats in Vietnamese units', () => {
    expect(humanInterval(5 * 60_000)).toBe('5 phút');
    expect(humanInterval(3 * 3_600_000)).toBe('3 giờ');
    expect(humanInterval(2 * 86_400_000)).toBe('2 ngày');
    expect(humanInterval(45 * 86_400_000)).toBe('1,5 tháng');
  });
});

describe('buildQueue', () => {
  it('puts due reviews first, then new items up to the daily limit', () => {
    const items = [item('1'), item('2'), item('3'), item('4'), item('5', { srs: due(0) })];
    const queue = buildQueue(db(items), NOW);
    expect(queue.map((c) => c.item.id)).toEqual(['5', '1', '2', '3']);
    expect(queue[0].mode).not.toBe('learn');
    expect(queue[1].mode).toBe('learn');
    expect(Object.keys(queue[1].intervals)).toEqual(['1', '2', '3', '4']);
  });

  it('skips incomplete items and filters by topic', () => {
    const items = [item('1', { examples: [] }), item('2', { topicId: 't2' }), item('3')];
    expect(buildQueue(db(items), NOW).map((c) => c.item.id)).toEqual(['2', '3']);
    expect(buildQueue(db(items), NOW, { topicId: 't2' }).map((c) => c.item.id)).toEqual(['2']);
  });

  it('counts new items already started today against the limit', () => {
    const logs: ReviewLog[] = [{ itemId: 'x', at: NOW.toISOString(), rating: 3, mode: 'learn' }];
    const items = [item('1'), item('2'), item('3')];
    expect(buildQueue(db(items, logs, 2), NOW)).toHaveLength(1);
  });
});

describe('computeStats', () => {
  it('reports due, new allowance and streak', () => {
    const yesterday = new Date(NOW.getTime() - 86_400_000).toISOString();
    const logs: ReviewLog[] = [
      { itemId: '5', at: yesterday, rating: 3, mode: 'learn' },
      { itemId: '5', at: NOW.toISOString(), rating: 3, mode: 'listen' },
    ];
    const items = [item('1'), item('2'), item('5', { srs: due(0) })];
    const stats = computeStats(db(items, logs), NOW);
    expect(stats).toMatchObject({ dueNow: 1, newToday: 2, reviewedToday: 1, streak: 2, learned: 1, total: 3 });
  });

  it('keeps yesterday’s streak alive before today’s first review', () => {
    const yesterday = new Date(NOW.getTime() - 86_400_000).toISOString();
    const logs: ReviewLog[] = [{ itemId: '1', at: yesterday, rating: 3, mode: 'learn' }];
    expect(computeStats(db([item('1')], logs), NOW).streak).toBe(1);
  });
});

describe('summariseTopics', () => {
  it('counts due reviews plus startable new items per topic', () => {
    const items = [
      item('1'),
      item('2'),
      item('3'),
      item('4'),
      item('5', { srs: due(0) }),
      item('6', { topicId: 't2' }),
      item('7', { examples: [] }),
    ];
    const [one, two] = summariseTopics(db(items, [], 3), NOW);
    expect(one).toMatchObject({ total: 6, learned: 1, due: 1 + 3, incomplete: 1 });
    expect(two).toMatchObject({ total: 1, learned: 0, due: 1, incomplete: 0 });
  });

  it('shows only due reviews once the daily new limit is used up', () => {
    const logs: ReviewLog[] = ['a', 'b', 'c'].map((id) => ({ itemId: id, at: NOW.toISOString(), rating: 3, mode: 'learn' }));
    const [one] = summariseTopics(db([item('1'), item('5', { srs: due(0) })], logs, 3), NOW);
    expect(one.due).toBe(1);
  });
});

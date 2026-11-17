// Spaced repetition (FSRS) and the daily queue. Pure functions over the DB shape.

import { createEmptyCard, fsrs, generatorParameters, Rating as FsrsRating } from 'ts-fsrs';
import type { Card, Grade } from 'ts-fsrs';
import type {
  DB,
  Item,
  Rating,
  ReviewCard,
  ReviewMode,
  SrsCard,
  Stats,
  TopicSummary,
} from '../shared/types';

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }));

const GRADES: Record<Rating, Grade> = {
  1: FsrsRating.Again,
  2: FsrsRating.Hard,
  3: FsrsRating.Good,
  4: FsrsRating.Easy,
};

function toFsrs(card: SrsCard | null, now: Date): Card {
  if (!card) return createEmptyCard(now);
  return {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  } as Card;
}

function fromFsrs(card: Card): SrsCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    last_review: card.last_review ? card.last_review.toISOString() : undefined,
  };
}

export function schedule(card: SrsCard | null, rating: Rating, now: Date): SrsCard {
  return fromFsrs(scheduler.next(toFsrs(card, now), now, GRADES[rating]).card);
}

/** "5 phút", "3 giờ", "2 ngày", "1,5 tháng" */
export function humanInterval(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ngày`;
  const months = days / 30;
  if (months < 12) return `${months.toFixed(months < 3 ? 1 : 0).replace('.', ',')} tháng`;
  return `${(days / 365).toFixed(1).replace('.', ',')} năm`;
}

export function intervals(card: SrsCard | null, now: Date): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const rating of [1, 2, 3, 4] as Rating[]) {
    const next = schedule(card, rating, now);
    out[rating] = humanInterval(new Date(next.due).getTime() - now.getTime());
  }
  return out;
}

/** Items are only study-ready once they have a meaning and something to shadow. */
export function isComplete(item: Item): boolean {
  return Boolean(item.meaningVi && item.examples.length > 0);
}

export function isDue(item: Item, now: Date): boolean {
  return item.srs !== null && new Date(item.srs.due).getTime() <= now.getTime();
}

function modeFor(item: Item): ReviewMode {
  if (!item.srs) return 'learn';
  // Alternate recall direction so both the ear and the mouth get trained.
  return item.srs.reps % 2 === 1 ? 'listen' : 'speak';
}

function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** New items first studied today (counts against the daily limit). */
function newStartedToday(db: DB, now: Date): number {
  const today = localDay(now);
  const seen = new Set<string>();
  for (const log of db.logs) {
    if (log.mode === 'learn' && localDay(new Date(log.at)) === today) seen.add(log.itemId);
  }
  return seen.size;
}

export function buildQueue(
  db: DB,
  now: Date,
  options: { topicId?: string; limit?: number } = {},
): ReviewCard[] {
  const pool = db.items.filter(
    (item) => isComplete(item) && (!options.topicId || item.topicId === options.topicId),
  );
  const due = pool
    .filter((item) => isDue(item, now))
    .sort((a, b) => new Date(a.srs!.due).getTime() - new Date(b.srs!.due).getTime());
  const allowance = Math.max(0, db.settings.newPerDay - newStartedToday(db, now));
  const fresh = pool
    .filter((item) => item.srs === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, allowance);
  return [...due, ...fresh].slice(0, options.limit ?? 20).map((item) => ({
    item,
    mode: modeFor(item),
    intervals: intervals(item.srs, now),
  }));
}

export function computeStats(db: DB, now: Date): Stats {
  const today = localDay(now);
  const studyable = db.items.filter(isComplete);
  const dueNow = studyable.filter((item) => isDue(item, now)).length;
  const allowance = Math.max(0, db.settings.newPerDay - newStartedToday(db, now));
  const newToday = Math.min(allowance, studyable.filter((item) => item.srs === null).length);

  const days = new Set(db.logs.map((log) => localDay(new Date(log.at))));
  const reviewedToday = db.logs.filter((log) => localDay(new Date(log.at)) === today).length;
  let streak = 0;
  const cursor = new Date(now);
  // A streak survives until the end of today even if nothing was reviewed yet.
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(localDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const upcoming = studyable
    .filter((item) => item.srs !== null && !isDue(item, now))
    .map((item) => item.srs!.due)
    .sort();
  return {
    dueNow,
    newToday,
    reviewedToday,
    streak,
    learned: db.items.filter((item) => item.srs !== null).length,
    total: db.items.length,
    nextDue: upcoming[0] ?? null,
  };
}

/** `due` per topic counts due reviews plus the new items that could be started today. */
export function summariseTopics(db: DB, now: Date): TopicSummary[] {
  const allowance = Math.max(0, db.settings.newPerDay - newStartedToday(db, now));
  return db.topics.map((topic) => {
    const items = db.items.filter((item) => item.topicId === topic.id);
    const fresh = items.filter((item) => isComplete(item) && item.srs === null).length;
    return {
      ...topic,
      total: items.length,
      learned: items.filter((item) => item.srs !== null).length,
      due: items.filter((item) => isComplete(item) && isDue(item, now)).length + Math.min(fresh, allowance),
      incomplete: items.filter((item) => !isComplete(item)).length,
    };
  });
}

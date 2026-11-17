// Merges words written by a Claude Code session (or by hand) into the data file.
// Used by scripts/import-words.mjs; pure over the DB so it can be tested.

import type { DB, Topic } from '../shared/types';
import { normaliseItems } from './prompts';
import { addItems, makeTopic } from './store';

export type ImportBatch = {
  /** Existing topic id, or omit and give `topic`. */
  topicId?: string;
  /** Topic matched by name (case-insensitive); created when missing. */
  topic?: { name: string; emoji?: string; description?: string };
  items: unknown[];
};

export type ImportReport = {
  topic: string;
  topicId: string;
  created: boolean;
  added: string[];
  skipped: string[];
  /** Added items still missing a meaning or examples (the app can generate them). */
  incomplete: string[];
};

function findTopic(db: DB, batch: ImportBatch): { topic: Topic; created: boolean } {
  if (batch.topicId) {
    const topic = db.topics.find((t) => t.id === batch.topicId);
    if (!topic) throw new Error(`Không có chủ đề id "${batch.topicId}".`);
    return { topic, created: false };
  }
  const name = batch.topic?.name?.trim();
  if (!name) throw new Error('Mỗi lô cần "topicId" hoặc "topic": { "name": ... }.');
  const existing = db.topics.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return { topic: existing, created: false };
  const topic = makeTopic({ ...batch.topic!, name });
  db.topics.push(topic);
  return { topic, created: true };
}

/** Accepts one batch, an array of batches, or a bare list of strings/items with a topic. */
export function importWords(db: DB, input: unknown): ImportReport[] {
  const batches = (Array.isArray(input) ? input : [input]) as ImportBatch[];
  return batches.map((batch) => {
    if (!batch || !Array.isArray(batch.items)) throw new Error('Mỗi lô cần mảng "items".');
    const { topic, created } = findTopic(db, batch);
    const raw = batch.items.map((entry) => (typeof entry === 'string' ? { text: entry } : entry));
    const { added, skipped } = addItems(db, topic.id, normaliseItems({ items: raw }));
    return {
      topic: topic.name,
      topicId: topic.id,
      created,
      added: added.map((i) => i.text),
      skipped,
      incomplete: added.filter((i) => !i.meaningVi || i.examples.length === 0).map((i) => i.text),
    };
  });
}

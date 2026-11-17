// Single-file JSON store. Synchronous on purpose: one learner, small data, no races.
// The file is re-read whenever it changes on disk, so items added from a Claude Code
// session (scripts/import-words.mjs) show up without restarting the app.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DB, Item, Settings, Topic } from '../shared/types';
import { seedDb } from './seed';

export const DEFAULT_SETTINGS: Settings = {
  voice: 'en-GB-SoniaNeural',
  rate: 1,
  model: 'sonnet',
  newPerDay: 8,
  level: 'B1',
};

export function dataDir(): string {
  return process.env.SPEAKEASY_DATA_DIR
    ? path.resolve(process.env.SPEAKEASY_DATA_DIR)
    : path.resolve('data');
}

function dbPath(): string {
  return path.join(dataDir(), 'db.json');
}

let cache: { db: DB; mtimeMs: number } | null = null;

function normalise(raw: Partial<DB>): DB {
  return {
    version: 1,
    topics: raw.topics ?? [],
    items: (raw.items ?? []).map((item) => ({
      ...item,
      examples: item.examples ?? [],
      srs: item.srs ?? null,
    })),
    logs: raw.logs ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
  };
}

export function load(): DB {
  const file = dbPath();
  if (!fs.existsSync(file)) {
    const db = seedDb(DEFAULT_SETTINGS);
    save(db);
    return db;
  }
  const mtimeMs = fs.statSync(file).mtimeMs;
  if (cache && cache.mtimeMs === mtimeMs) return cache.db;
  const db = normalise(JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<DB>);
  cache = { db, mtimeMs };
  return db;
}

export function save(db: DB): void {
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, file); // atomic replace: a crash never leaves a half-written db
  cache = { db, mtimeMs: fs.statSync(file).mtimeMs };
}

/** Load, change, save. Returns whatever the callback returns. */
export function mutate<T>(change: (db: DB) => T): T {
  const db = load();
  const result = change(db);
  save(db);
  return result;
}

export function newId(): string {
  return randomUUID().slice(0, 8);
}

/** Comparison key used to detect duplicates inside a topic. */
export function itemKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();
}

export function cleanText(text: string): string {
  return text
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function makeTopic(input: { name: string; emoji?: string; description?: string }): Topic {
  return {
    id: newId(),
    name: input.name.trim(),
    emoji: input.emoji?.trim() || '📘',
    description: input.description?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}

export function makeItem(topicId: string, text: string, extra: Partial<Item> = {}): Item {
  const clean = cleanText(text);
  return {
    examples: [],
    ...extra,
    id: newId(),
    topicId,
    text: clean,
    kind: clean.includes(' ') ? 'phrase' : 'word',
    createdAt: new Date().toISOString(),
    srs: null,
  };
}

/** Adds items, skipping blanks and duplicates within the topic. */
export function addItems(
  db: DB,
  topicId: string,
  entries: Array<{ text: string } & Partial<Item>>,
): { added: Item[]; skipped: string[] } {
  const seen = new Set(db.items.filter((i) => i.topicId === topicId).map((i) => itemKey(i.text)));
  const added: Item[] = [];
  const skipped: string[] = [];
  for (const entry of entries) {
    const text = cleanText(entry.text ?? '');
    const key = itemKey(text);
    if (!key) continue;
    if (seen.has(key) || text.length > 120) {
      skipped.push(text);
      continue;
    }
    seen.add(key);
    const { text: _text, ...extra } = entry;
    const item = makeItem(topicId, text, extra);
    db.items.push(item);
    added.push(item);
  }
  return { added, skipped };
}

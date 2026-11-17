// Local HTTP API on 127.0.0.1. The renderer only ever calls fetch('/api/...'), so the UI
// runs the same in Electron and in a normal browser. In production it also serves dist/.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type {
  AppState,
  CoachReply,
  Health,
  Level,
  Rating,
  ReviewCard,
  ReviewMode,
  Settings,
  TalkReply,
  TalkTurn,
  WordResult,
} from '../shared/types';
import { claudeHealth, runClaude, TutorError } from './claude';
import { compare } from './pronounce';
import {
  coachTask,
  enrichTask,
  matchEnriched,
  normaliseCoach,
  normaliseItems,
  normaliseTalk,
  suggestTask,
  talkTask,
} from './prompts';
import { buildQueue, computeStats, intervals, schedule, summariseTopics } from './srs';
import { addItems, dataDir, itemKey, load, makeTopic, mutate } from './store';
import { loadAsr, sttStatus, transcribe } from './stt';
import { isVoice, synth, VOICES } from './tts';

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Req = { method: string; path: string; query: URLSearchParams; body: () => Promise<Buffer> };
type Res = http.ServerResponse;

const LEVELS: Level[] = ['A2', 'B1', 'B2', 'C1'];
const MODELS = ['haiku', 'sonnet', 'opus'];

function json(res: Res, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readJson<T>(req: Req): Promise<T> {
  const buf = await req.body();
  if (!buf.length) return {} as T;
  try {
    return JSON.parse(buf.toString('utf8')) as T;
  } catch {
    throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ.');
  }
}

function findTopic(id: string) {
  const db = load();
  const topic = db.topics.find((t) => t.id === id);
  if (!topic) throw new HttpError(404, 'Không tìm thấy chủ đề.');
  return { db, topic };
}

/** Enriches the given items with Claude in small parallel batches (SC-002). */
async function enrichItems(topicId: string, itemIds: string[]): Promise<number> {
  const { db, topic } = findTopic(topicId);
  const targets = db.items.filter((i) => i.topicId === topicId && itemIds.includes(i.id));
  const batches: (typeof targets)[] = [];
  for (let i = 0; i < targets.length; i += 4) batches.push(targets.slice(i, i + 4));
  let done = 0;
  const errors: string[] = [];
  const queue = [...batches];
  const worker = async () => {
    for (let batch = queue.shift(); batch; batch = queue.shift()) {
      const texts = batch.map((i) => i.text);
      try {
        const raw = await runClaude<unknown>({ ...enrichTask(texts, topic), model: db.settings.model });
        const matched = matchEnriched(texts, normaliseItems(raw), itemKey);
        // Save each batch as it lands, so nothing is lost if a later batch fails.
        mutate((fresh) => {
          batch.forEach((item, index) => {
            const gen = matched[index];
            const target = fresh.items.find((i) => i.id === item.id);
            if (!gen || !target) return;
            const { text: _ignored, ...fields } = gen;
            Object.assign(target, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)));
            if (!gen.examples.length) target.examples = item.examples;
            done++;
          });
        });
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (!done && errors.length) throw new TutorError(errors[0]);
  return done;
}

async function route(req: Req, res: Res): Promise<void> {
  const { method, path: p } = req;
  const now = new Date();
  let m: RegExpMatchArray | null;

  if (method === 'GET' && p === '/api/state') {
    const db = load();
    const state: AppState = { topics: summariseTopics(db, now), stats: computeStats(db, now), settings: db.settings };
    return json(res, 200, state);
  }

  if (method === 'GET' && p === '/api/health') {
    const health: Health = { claude: await claudeHealth(), stt: sttStatus(), dataDir: dataDir() };
    return json(res, 200, health);
  }

  // ---- topics ----
  if (method === 'POST' && p === '/api/topics') {
    const body = await readJson<{ name?: string; emoji?: string; description?: string }>(req);
    if (!body.name?.trim()) throw new HttpError(400, 'Hãy nhập tên chủ đề.');
    const topic = mutate((db) => {
      const t = makeTopic({ name: body.name!, emoji: body.emoji, description: body.description });
      db.topics.push(t);
      return t;
    });
    return json(res, 201, topic);
  }

  if ((m = p.match(/^\/api\/topics\/([\w-]+)$/))) {
    const id = m[1];
    if (method === 'GET') {
      const { db, topic } = findTopic(id);
      const items = db.items.filter((i) => i.topicId === id);
      return json(res, 200, { topic, items });
    }
    if (method === 'PATCH') {
      const body = await readJson<{ name?: string; emoji?: string; description?: string }>(req);
      findTopic(id);
      const topic = mutate((db) => {
        const t = db.topics.find((x) => x.id === id)!;
        if (body.name?.trim()) t.name = body.name.trim();
        if (body.emoji?.trim()) t.emoji = body.emoji.trim();
        if (body.description !== undefined) t.description = body.description.trim() || undefined;
        return t;
      });
      return json(res, 200, topic);
    }
    if (method === 'DELETE') {
      findTopic(id);
      mutate((db) => {
        const ids = new Set(db.items.filter((i) => i.topicId === id).map((i) => i.id));
        db.topics = db.topics.filter((t) => t.id !== id);
        db.items = db.items.filter((i) => i.topicId !== id);
        db.logs = db.logs.filter((l) => !ids.has(l.itemId));
      });
      return json(res, 200, { ok: true });
    }
  }

  if (method === 'POST' && (m = p.match(/^\/api\/topics\/([\w-]+)\/items$/))) {
    const id = m[1];
    findTopic(id);
    const body = await readJson<{ lines?: string }>(req);
    const entries = (body.lines ?? '').split(/\r?\n/).map((text) => ({ text }));
    const result = mutate((db) => addItems(db, id, entries));
    return json(res, 201, result);
  }

  if (method === 'POST' && (m = p.match(/^\/api\/topics\/([\w-]+)\/suggest$/))) {
    const id = m[1];
    const { db, topic } = findTopic(id);
    const body = await readJson<{ count?: number; level?: Level; hint?: string }>(req);
    const count = Math.min(15, Math.max(1, Math.round(body.count ?? 6)));
    const level = LEVELS.includes(body.level as Level) ? (body.level as Level) : db.settings.level;
    const existing = db.items.filter((i) => i.topicId === id).map((i) => i.text);
    const raw = await runClaude<unknown>({
      ...suggestTask({ topic, existing, count, level, hint: body.hint?.trim().slice(0, 300) }),
      model: db.settings.model,
    });
    const generated = normaliseItems(raw);
    const result = mutate((fresh) => addItems(fresh, id, generated));
    return json(res, 201, result);
  }

  if (method === 'POST' && (m = p.match(/^\/api\/topics\/([\w-]+)\/enrich$/))) {
    const id = m[1];
    const { db } = findTopic(id);
    const body = await readJson<{ itemIds?: string[] }>(req);
    const ids = body.itemIds?.length
      ? body.itemIds
      : db.items.filter((i) => i.topicId === id && (!i.meaningVi || i.examples.length < 2 || !i.ipa)).map((i) => i.id);
    if (!ids.length) return json(res, 200, { updated: 0 });
    const updated = await enrichItems(id, ids);
    return json(res, 200, { updated });
  }

  // ---- items ----
  if ((m = p.match(/^\/api\/items\/([\w-]+)$/))) {
    const id = m[1];
    if (!load().items.some((i) => i.id === id)) throw new HttpError(404, 'Không tìm thấy mục từ.');
    if (method === 'PATCH') {
      const body = await readJson<Record<string, unknown>>(req);
      const allowed = ['text', 'ipa', 'pos', 'meaningVi', 'definitionEn', 'examples', 'tip'];
      const item = mutate((db) => {
        const it = db.items.find((i) => i.id === id)!;
        for (const k of allowed) if (k in body) (it as Record<string, unknown>)[k] = body[k];
        if (body.resetSrs) it.srs = null;
        it.kind = it.text.includes(' ') ? 'phrase' : 'word';
        return it;
      });
      return json(res, 200, item);
    }
    if (method === 'DELETE') {
      mutate((db) => {
        db.items = db.items.filter((i) => i.id !== id);
        db.logs = db.logs.filter((l) => l.itemId !== id);
      });
      return json(res, 200, { ok: true });
    }
  }

  // ---- review ----
  if (method === 'GET' && p === '/api/review') {
    const topicId = req.query.get('topicId') || undefined;
    return json(res, 200, buildQueue(load(), now, { topicId, limit: 30 }));
  }

  if (method === 'POST' && p === '/api/review') {
    const body = await readJson<{ itemId?: string; rating?: number; mode?: ReviewMode; score?: number }>(req);
    const rating = body.rating as Rating;
    if (![1, 2, 3, 4].includes(rating)) throw new HttpError(400, 'Mức đánh giá không hợp lệ.');
    const card = mutate((db): ReviewCard => {
      const item = db.items.find((i) => i.id === body.itemId);
      if (!item) throw new HttpError(404, 'Không tìm thấy mục từ.');
      item.srs = schedule(item.srs, rating, now);
      db.logs.push({
        itemId: item.id,
        at: now.toISOString(),
        rating,
        mode: body.mode ?? 'listen',
        ...(typeof body.score === 'number' ? { score: Math.round(body.score) } : {}),
      });
      return { item, mode: item.srs.reps % 2 === 1 ? 'listen' : 'speak', intervals: intervals(item.srs, now) };
    });
    return json(res, 200, card);
  }

  // ---- voice ----
  if (method === 'GET' && p === '/api/voices') return json(res, 200, VOICES);

  if (method === 'GET' && p === '/api/tts') {
    const text = req.query.get('text') ?? '';
    if (!text.trim()) throw new HttpError(400, 'Thiếu nội dung cần đọc.');
    const settings = load().settings;
    const voice = isVoice(req.query.get('voice') ?? '') ? req.query.get('voice')! : settings.voice;
    const rate = Number(req.query.get('rate') ?? settings.rate) || 1;
    const file = await synth(text, voice, rate);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': fs.statSync(file).size,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(file).pipe(res);
    return;
  }

  // ---- speech recognition + comparison ----
  if (method === 'POST' && p === '/api/stt') {
    const buf = await req.body();
    if (buf.length % 4 !== 0) throw new HttpError(400, 'Âm thanh không hợp lệ.');
    const pcm = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
    const text = await transcribe(pcm);
    const target = req.query.get('target');
    return json(res, 200, { text, result: target && text ? compare(target, text) : null });
  }

  if (method === 'POST' && p === '/api/stt/warmup') {
    loadAsr().catch(() => undefined);
    return json(res, 200, sttStatus());
  }

  if (method === 'POST' && p === '/api/coach') {
    const body = await readJson<{ target?: string; heard?: string; words?: WordResult[] }>(req);
    if (!body.target) throw new HttpError(400, 'Thiếu câu mục tiêu.');
    const raw = await runClaude<unknown>({
      ...coachTask({ target: body.target, heard: body.heard ?? '', words: body.words ?? [] }),
      model: load().settings.model,
    });
    const reply: CoachReply = normaliseCoach(raw);
    return json(res, 200, reply);
  }

  if (method === 'POST' && p === '/api/talk') {
    const body = await readJson<{ scenario?: string; topicId?: string; history?: TalkTurn[] }>(req);
    const db = load();
    const phrases = body.topicId ? db.items.filter((i) => i.topicId === body.topicId).map((i) => i.text).slice(0, 30) : [];
    const history = (body.history ?? []).slice(-16).map((t) => ({ role: t.role, text: String(t.text).slice(0, 600) }));
    const raw = await runClaude<unknown>({
      ...talkTask({ scenario: body.scenario?.trim() || 'A friendly chat', phrases, history, level: db.settings.level }),
      model: db.settings.model,
    });
    const reply: TalkReply = normaliseTalk(raw);
    if (!reply.reply) throw new TutorError('Claude chưa trả lời được. Hãy thử lại.');
    return json(res, 200, reply);
  }

  // ---- settings ----
  if (method === 'PUT' && p === '/api/settings') {
    const body = await readJson<Partial<Settings>>(req);
    const settings = mutate((db) => {
      const s = db.settings;
      if (body.voice && isVoice(body.voice)) s.voice = body.voice;
      if (typeof body.rate === 'number') s.rate = Math.min(1.3, Math.max(0.6, body.rate));
      if (body.model && MODELS.includes(body.model)) s.model = body.model;
      if (typeof body.newPerDay === 'number') s.newPerDay = Math.min(50, Math.max(0, Math.round(body.newPerDay)));
      if (body.level && LEVELS.includes(body.level)) s.level = body.level;
      return s;
    });
    return json(res, 200, settings);
  }

  throw new HttpError(404, 'Không có API này.');
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(staticDir: string, urlPath: string, res: Res): void {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  let file = path.resolve(staticDir, rel);
  if (!file.startsWith(path.resolve(staticDir)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(staticDir, 'index.html'); // single-page app fallback
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

export function startServer(options: { port: number; staticDir?: string }): Promise<{ port: number; close: () => void }> {
  const server = http.createServer((request, res) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (!url.pathname.startsWith('/api/')) {
      if (options.staticDir) return serveStatic(options.staticDir, url.pathname, res);
      return json(res, 404, { error: 'Not found' });
    }
    let cached: Promise<Buffer> | null = null;
    const req: Req = {
      method: request.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: () =>
        (cached ??= new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          let size = 0;
          request.on('data', (c: Buffer) => {
            size += c.length;
            if (size > 8 * 1024 * 1024) {
              reject(new HttpError(413, 'Dữ liệu quá lớn.'));
              request.destroy();
            } else chunks.push(c);
          });
          request.on('end', () => resolve(Buffer.concat(chunks)));
          request.on('error', reject);
        })),
    };
    route(req, res).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : err instanceof TutorError ? 502 : 500;
      const message = err instanceof Error ? err.message : String(err);
      if (status === 500) console.error('[api]', req.method, req.path, err);
      if (!res.headersSent) json(res, status, { error: message });
      else res.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : options.port;
      resolve({ port, close: () => server.close() });
    });
  });
}

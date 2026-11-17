// Typed client for the local API. Errors carry the server's Vietnamese message.

import type {
  AppState,
  CoachReply,
  Health,
  Item,
  Level,
  PronounceResult,
  Rating,
  ReviewCard,
  ReviewMode,
  Settings,
  TalkReply,
  TalkTurn,
  Topic,
  VoiceInfo,
  WordResult,
} from '../shared/types';

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được tới máy chủ cục bộ của ứng dụng.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
  return data;
}

type AddResult = { added: Item[]; skipped: string[] };

export const api = {
  state: () => call<AppState>('GET', '/api/state'),
  health: () => call<Health>('GET', '/api/health'),

  createTopic: (t: { name: string; emoji?: string; description?: string }) => call<Topic>('POST', '/api/topics', t),
  topic: (id: string) => call<{ topic: Topic; items: Item[] }>('GET', `/api/topics/${id}`),
  updateTopic: (id: string, t: Partial<Pick<Topic, 'name' | 'emoji' | 'description'>>) =>
    call<Topic>('PATCH', `/api/topics/${id}`, t),
  deleteTopic: (id: string) => call<{ ok: true }>('DELETE', `/api/topics/${id}`),
  addItems: (id: string, lines: string) => call<AddResult>('POST', `/api/topics/${id}/items`, { lines }),
  suggest: (id: string, opts: { count: number; level: Level; hint?: string }) =>
    call<AddResult>('POST', `/api/topics/${id}/suggest`, opts),
  enrich: (id: string, itemIds?: string[]) => call<{ updated: number }>('POST', `/api/topics/${id}/enrich`, { itemIds }),

  updateItem: (id: string, patch: Partial<Item> & { resetSrs?: boolean }) => call<Item>('PATCH', `/api/items/${id}`, patch),
  deleteItem: (id: string) => call<{ ok: true }>('DELETE', `/api/items/${id}`),

  queue: (topicId?: string) => call<ReviewCard[]>('GET', `/api/review${topicId ? `?topicId=${topicId}` : ''}`),
  grade: (body: { itemId: string; rating: Rating; mode: ReviewMode; score?: number }) =>
    call<ReviewCard>('POST', '/api/review', body),

  voices: () => call<VoiceInfo[]>('GET', '/api/voices'),
  saveSettings: (s: Partial<Settings>) => call<Settings>('PUT', '/api/settings', s),

  warmupStt: () => call<Health['stt']>('POST', '/api/stt/warmup'),
  stt: async (pcm: Float32Array, target?: string): Promise<{ text: string; result: PronounceResult | null }> => {
    const url = `/api/stt${target ? `?target=${encodeURIComponent(target)}` : ''}`;
    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: new Blob([pcm.slice()]) });
    } catch {
      throw new Error('Không kết nối được tới máy chủ cục bộ của ứng dụng.');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
    return data;
  },
  coach: (body: { target: string; heard: string; words: WordResult[] }) => call<CoachReply>('POST', '/api/coach', body),
  talk: (body: { scenario: string; topicId?: string; history: TalkTurn[] }) => call<TalkReply>('POST', '/api/talk', body),
};

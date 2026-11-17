// Local speech-to-text with Whisper (English) via transformers.js. The model (~76 MB) is
// downloaded once into data/models; after that recognition works offline.

import path from 'node:path';
import type { Health } from '../shared/types';
import { dataDir } from './store';

const MODEL = 'onnx-community/whisper-base.en';
type Asr = (audio: Float32Array, options?: Record<string, unknown>) => Promise<unknown>;

let state: Health['stt'] = { state: 'idle', detail: 'Chưa tải mô hình nhận giọng nói.' };
let loading: Promise<Asr> | null = null;

export function sttStatus(): Health['stt'] {
  return state;
}

export function loadAsr(): Promise<Asr> {
  if (loading) return loading;
  state = { state: 'loading', detail: 'Đang tải mô hình nhận giọng nói (lần đầu ~76 MB)…' };
  loading = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = path.join(dataDir(), 'models');
    const files = new Map<string, number>();
    const asr = (await pipeline('automatic-speech-recognition', MODEL, {
      dtype: 'q8',
      progress_callback: (p: { status: string; file?: string; progress?: number }) => {
        if (p.status === 'progress' && p.file) {
          files.set(p.file, p.progress ?? 0);
          const pct = Math.round([...files.values()].reduce((a, b) => a + b, 0) / Math.max(files.size, 1));
          state = { state: 'loading', detail: `Đang tải mô hình nhận giọng nói… ${pct}%` };
        }
      },
    })) as unknown as Asr;
    state = { state: 'ready', detail: 'Whisper base.en chạy trên máy.' };
    return asr;
  })().catch((err: unknown) => {
    loading = null;
    state = { state: 'error', detail: `Không tải được mô hình: ${err instanceof Error ? err.message : String(err)}` };
    throw err;
  });
  return loading;
}

function rms(pcm: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / Math.max(pcm.length, 1));
}

// What Whisper tends to "hear" in silence or noise.
const HALLUCINATIONS = /^(you|thank you|thanks for watching|bye|okay|so|\.+)$/i;

/** Transcribes 16 kHz mono PCM. Returns '' for silence or noise ("didn't catch that"). */
export async function transcribe(pcm: Float32Array): Promise<string> {
  if (pcm.length < 16000 * 0.3) return '';
  const level = rms(pcm);
  if (level < 0.003) return '';
  const asr = await loadAsr();
  const out = (await asr(pcm.subarray(0, 16000 * 30))) as { text?: string } | Array<{ text?: string }>;
  const raw = (Array.isArray(out) ? out[0]?.text : out.text) ?? '';
  const text = raw.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (level < 0.02 && HALLUCINATIONS.test(text.replace(/[.!?,]+$/, ''))) return '';
  return text;
}

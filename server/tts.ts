// British neural voices (Microsoft Edge read-aloud), cached to disk as MP3 so anything
// heard once replays instantly and offline (FR-005, SC-006).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { VoiceInfo } from '../shared/types';
import { dataDir } from './store';

export const VOICES: VoiceInfo[] = [
  { id: 'en-GB-SoniaNeural', name: 'Sonia', gender: 'Female', noteVi: 'Nữ, giọng chuẩn RP, ấm và rõ — dễ nghe nhất để học.' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', gender: 'Male', noteVi: 'Nam, thân thiện, tốc độ tự nhiên.' },
  { id: 'en-GB-LibbyNeural', name: 'Libby', gender: 'Female', noteVi: 'Nữ, trẻ trung, vui vẻ.' },
  { id: 'en-GB-ThomasNeural', name: 'Thomas', gender: 'Male', noteVi: 'Nam, trầm và điềm tĩnh.' },
  { id: 'en-GB-MaisieNeural', name: 'Maisie', gender: 'Female', noteVi: 'Giọng bé gái — vui, nhưng ít hợp để học.' },
];

export function isVoice(id: string): boolean {
  return VOICES.some((v) => v.id === id);
}

function ratePercent(rate: number): string {
  const pct = Math.round((rate - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const inflight = new Map<string, Promise<string>>();

/** Returns the path of a cached MP3 for this text/voice/speed, synthesising it if needed. */
export function synth(text: string, voice: string, rate: number): Promise<string> {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 1000);
  const r = Math.min(1.5, Math.max(0.5, Math.round(rate * 100) / 100));
  const key = crypto.createHash('sha1').update(`${voice}|${r}|${clean}`).digest('hex');
  const file = path.join(dataDir(), 'tts-cache', `${key}.mp3`);
  if (fs.existsSync(file)) return Promise.resolve(file);
  const running = inflight.get(key);
  if (running) return running;

  const job = (async () => {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(escapeXml(clean), { rate: ratePercent(r) });
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Dịch vụ giọng đọc không phản hồi.')), 20_000);
        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.on('end', () => (clearTimeout(timer), resolve()));
        audioStream.on('close', () => (clearTimeout(timer), resolve()));
        audioStream.on('error', (err) => (clearTimeout(timer), reject(err)));
      });
      const audio = Buffer.concat(chunks);
      if (audio.length < 500) throw new Error('Dịch vụ giọng đọc trả về âm thanh rỗng.');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, audio);
      fs.renameSync(tmp, file);
      return file;
    } finally {
      tts.close();
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}

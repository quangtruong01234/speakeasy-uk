// Playback of the British model voice and recording of the learner.

let voice = 'en-GB-SoniaNeural';
let rate = 1;
export function setVoice(v: string, r: number): void {
  voice = v;
  rate = r;
}

export const SLOW = 0.75;

let current: HTMLAudioElement | null = null;
const listeners = new Set<(playing: string | null) => void>();
let playingKey: string | null = null;

function notify(key: string | null) {
  playingKey = key;
  for (const fn of listeners) fn(key);
}

export function onPlaying(fn: (key: string | null) => void): () => void {
  listeners.add(fn);
  fn(playingKey);
  return () => listeners.delete(fn);
}

export function stopAudio(): void {
  current?.pause();
  current = null;
  speechSynthesis?.cancel();
  notify(null);
}

export function ttsUrl(text: string, opts: { slow?: boolean; voice?: string } = {}): string {
  const r = Math.round(rate * (opts.slow ? SLOW : 1) * 100) / 100;
  const params = new URLSearchParams({ text, voice: opts.voice ?? voice, rate: String(r) });
  return `/api/tts?${params}`;
}

/** Speaks text in the chosen British voice; falls back to the system en-GB voice offline. */
export function speak(text: string, opts: { slow?: boolean; voice?: string; key?: string } = {}): Promise<void> {
  stopAudio();
  const key = opts.key ?? `${text}|${opts.slow ? 's' : 'n'}`;
  const audio = new Audio(ttsUrl(text, opts));
  current = audio;
  notify(key);
  return new Promise<void>((resolve) => {
    const done = () => {
      if (current === audio) {
        current = null;
        notify(null);
      }
      resolve();
    };
    audio.onended = done;
    audio.onpause = done;
    audio.onerror = () => {
      if (current !== audio) return resolve();
      fallbackSpeak(text, opts.slow).then(done);
    };
    audio.play().catch(() => {
      // Autoplay can be blocked before the first click; treat as finished.
      done();
    });
  });
}

function fallbackSpeak(text: string, slow?: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    const gb = speechSynthesis.getVoices().find((v) => v.lang === 'en-GB');
    if (gb) u.voice = gb;
    u.rate = rate * (slow ? SLOW : 1);
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

export function playBlobUrl(url: string, key = 'mine'): Promise<void> {
  stopAudio();
  const audio = new Audio(url);
  current = audio;
  notify(key);
  return new Promise((resolve) => {
    const done = () => {
      if (current === audio) {
        current = null;
        notify(null);
      }
      resolve();
    };
    audio.onended = done;
    audio.onpause = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

// ---------- recording ----------

export class MicError extends Error {}

export type Recording = { url: string; pcm: Float32Array; seconds: number };

export async function startRecording(): Promise<{ stop: () => Promise<Recording>; cancel: () => void }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicError('Trình duyệt/ứng dụng không hỗ trợ ghi âm.');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new MicError(
        'Ứng dụng chưa được phép dùng micro. Vào Windows Settings → Privacy & security → Microphone, bật "Let desktop apps access your microphone", rồi thử lại. Bạn vẫn có thể nghe bình thường.',
      );
    }
    if (name === 'NotFoundError') throw new MicError('Không tìm thấy micro. Hãy cắm micro/tai nghe rồi thử lại.');
    throw new MicError(`Không mở được micro (${name ?? 'lỗi'}).`);
  }
  stopAudio();
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const started = performance.now();
  recorder.start();
  const maxTimer = window.setTimeout(() => recorder.state === 'recording' && recorder.stop(), 30_000);

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      window.clearTimeout(maxTimer);
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    };
  });

  return {
    stop: async () => {
      if (recorder.state === 'recording') recorder.stop();
      const blob = await finished;
      const pcm = await toPcm16k(blob);
      return { url: URL.createObjectURL(blob), pcm, seconds: (performance.now() - started) / 1000 };
    },
    cancel: () => {
      if (recorder.state === 'recording') recorder.stop();
    },
  };
}

/** Decodes any recorded/compressed audio to 16 kHz mono Float32 for Whisper. */
export async function toPcm16k(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(bytes);
    const frames = Math.max(1, Math.ceil(decoded.duration * 16000));
    const offline = new OfflineAudioContext(1, frames, 16000);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    void ctx.close();
  }
}

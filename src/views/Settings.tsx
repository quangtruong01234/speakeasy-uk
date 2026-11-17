import { useEffect, useState } from 'react';
import type { Level, VoiceInfo } from '../../shared/types';
import { api } from '../api';
import { useApp } from '../App';
import { speak } from '../audio';
import { Button, Card, ErrorNote, Spinner, usePlaying } from '../ui';

const SAMPLE = "Hiya! Fancy a cup of tea? I'm just popping to the shop, back in a tick.";

const MODELS = [
  { id: 'haiku', label: 'Haiku', note: 'Nhanh nhất, đủ dùng cho ví dụ đơn giản' },
  { id: 'sonnet', label: 'Sonnet', note: 'Cân bằng tốc độ và chất lượng (khuyên dùng)' },
  { id: 'opus', label: 'Opus', note: 'Chất lượng cao nhất, chậm hơn' },
];

const LEVELS: { id: Level; note: string }[] = [
  { id: 'A2', note: 'Sơ cấp' },
  { id: 'B1', note: 'Trung cấp' },
  { id: 'B2', note: 'Trung cao' },
  { id: 'C1', note: 'Nâng cao' },
];

export function SettingsView() {
  const { state, updateSettings, health, checkHealth, toast } = useApp();
  const s = state.settings;
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(s.rate);
  const playing = usePlaying();

  useEffect(() => {
    api.voices().then(setVoices, (e: Error) => setError(e.message));
    void checkHealth();
  }, [checkHealth]);

  async function save(patch: Parameters<typeof updateSettings>[0]) {
    try {
      await updateSettings(patch);
      toast('Đã lưu cài đặt.');
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-bold">Cài đặt</h1>
      {error && <ErrorNote message={error} />}

      <Card>
        <h2 className="mb-1 font-semibold">Giọng đọc (tiếng Anh – Anh)</h2>
        <p className="mb-3 text-sm text-muted">Bấm ▶ để nghe thử, bấm “Chọn” để dùng giọng đó trong toàn app.</p>
        {!voices ? (
          <Spinner />
        ) : (
          <ul className="flex flex-col gap-2">
            {voices.map((v) => {
              const key = `preview-${v.id}`;
              const selected = s.voice === v.id;
              return (
                <li
                  key={v.id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${selected ? 'border-brand bg-brand-soft/60' : 'border-line bg-white'}`}
                >
                  <button
                    onClick={() => void speak(SAMPLE, { voice: v.id, key })}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand hover:bg-brand hover:text-white"
                    aria-label={`Nghe thử giọng ${v.name}`}
                  >
                    {playing === key ? '■' : '▶'}
                  </button>
                  <div className="flex-1">
                    <div className="font-medium">
                      {v.name} <span className="text-sm text-muted">· {v.gender === 'Female' ? 'Nữ' : 'Nam'}</span>
                    </div>
                    <div className="text-sm text-muted">{v.noteVi}</div>
                  </div>
                  {selected ? (
                    <span className="text-sm font-medium text-brand">✓ Đang dùng</span>
                  ) : (
                    <Button onClick={() => save({ voice: v.id })}>Chọn</Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Tốc độ đọc: {rate.toFixed(2)}×</h2>
        <p className="mb-3 text-sm text-muted">1.00× là tốc độ tự nhiên. Nút 🐢 luôn đọc chậm hơn mức này 25%.</p>
        <div className="flex items-center gap-3">
          <span className="text-sm">0.6×</span>
          <input
            type="range"
            min={0.6}
            max={1.3}
            step={0.05}
            value={rate}
            aria-label="Tốc độ đọc"
            onChange={(e) => setRate(Number(e.target.value))}
            onPointerUp={() => save({ rate })}
            onKeyUp={() => save({ rate })}
            className="flex-1 accent-brand"
          />
          <span className="text-sm">1.3×</span>
          <Button variant="ghost" onClick={() => void speak(SAMPLE, { key: 'rate-preview' })}>
            ▶ Nghe thử
          </Button>
        </div>
      </Card>

      <Card className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <h2 className="mb-1 font-semibold">Số từ mới mỗi ngày</h2>
          <p className="mb-2 text-sm text-muted">Ít mà đều sẽ nhớ lâu hơn. 5–10 là vừa.</p>
          <select
            value={s.newPerDay}
            onChange={(e) => save({ newPerDay: Number(e.target.value) })}
            className="rounded-lg border border-line bg-white px-3 py-2"
            aria-label="Số từ mới mỗi ngày"
          >
            {[3, 5, 8, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n} từ
              </option>
            ))}
          </select>
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Trình độ của bạn</h2>
          <p className="mb-2 text-sm text-muted">Claude dùng để chọn từ và nói chuyện vừa sức.</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Trình độ">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={s.level === l.id}
                onClick={() => save({ level: l.id })}
                title={l.note}
                className={`rounded-lg px-3 py-2 text-sm ${s.level === l.id ? 'bg-brand text-white' : 'border border-line bg-white'}`}
              >
                {l.id}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Mô hình Claude cho tutor</h2>
        <p className="mb-3 text-sm text-muted">Dùng Claude Code đã đăng nhập trên máy này, không cần API key riêng.</p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Mô hình">
          {MODELS.map((m) => (
            <label key={m.id} className="flex items-center gap-3 text-sm">
              <input type="radio" name="model" checked={s.model === m.id} onChange={() => save({ model: m.id })} />
              <span className="w-16 font-medium">{m.label}</span>
              <span className="text-muted">{m.note}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Trạng thái</h2>
        {!health ? (
          <Spinner />
        ) : (
          <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Claude Code</dt>
            <dd className={health.claude.ok ? 'text-good' : 'text-bad'}>
              {health.claude.ok ? '✓ ' : '✕ '}
              {health.claude.detail}
            </dd>
            <dt className="text-muted">Nhận dạng giọng nói</dt>
            <dd>
              {{ idle: 'Chưa tải', loading: 'Đang tải mô hình…', ready: '✓ Sẵn sàng (chạy offline trên máy)', error: '✕ Lỗi' }[health.stt.state]}
              {health.stt.detail && <span className="text-muted"> · {health.stt.detail}</span>}
            </dd>
            <dt className="text-muted">Thư mục dữ liệu</dt>
            <dd className="font-mono text-xs break-all">{health.dataDir}</dd>
          </dl>
        )}
        <Button variant="ghost" className="mt-3" onClick={checkHealth}>
          ↻ Kiểm tra lại
        </Button>
      </Card>
    </div>
  );
}

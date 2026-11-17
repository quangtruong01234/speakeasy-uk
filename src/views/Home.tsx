import { useState } from 'react';
import { api } from '../api';
import { go, href, useApp } from '../App';
import { Button, Card, ErrorNote, Modal } from '../ui';

function relative(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ngay bây giờ';
  const min = Math.round(ms / 60000);
  if (min < 60) return `sau ${min} phút`;
  const h = Math.round(min / 60);
  if (h < 24) return `sau ${h} giờ`;
  return `sau ${Math.round(h / 24)} ngày`;
}

export function Home() {
  const { state } = useApp();
  const { stats, topics } = state;
  const [creating, setCreating] = useState(false);
  const todo = stats.dueNow + stats.newToday;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-7">
      <header>
        <h1 className="text-2xl font-bold">Chào bạn 👋</h1>
        <p className="text-muted">Mỗi ngày một chút: nghe giọng Anh, nói theo, rồi ôn đúng lúc sắp quên.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Card className="flex flex-col justify-between gap-3 bg-brand! text-white">
          <div>
            <div className="text-sm opacity-80">Bài hôm nay</div>
            <div className="text-4xl font-bold">{todo}</div>
            <div className="text-sm opacity-80">
              {todo > 0
                ? `${stats.dueNow} thẻ cần ôn · ${stats.newToday} từ mới`
                : stats.nextDue
                  ? `Hết bài rồi! Lượt tiếp ${relative(stats.nextDue)}.`
                  : 'Thêm từ vào chủ đề để bắt đầu.'}
            </div>
          </div>
          <button
            className="self-start rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60"
            disabled={todo === 0}
            onClick={() => go({ name: 'review' })}
          >
            Bắt đầu ôn ▸
          </button>
        </Card>
        <Stat label="Đã ôn hôm nay" value={stats.reviewedToday} />
        <Stat label="Chuỗi ngày" value={stats.streak} suffix={stats.streak ? '🔥' : ''} />
        <Stat label="Đã học" value={stats.learned} suffix={`/ ${stats.total}`} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Chủ đề</h2>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => go({ name: 'talk' })}>
              💬 Nói chuyện với tutor
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              + Chủ đề mới
            </Button>
          </div>
        </div>
        {topics.length === 0 ? (
          <Card className="text-center text-muted">Chưa có chủ đề nào. Tạo một chủ đề, rồi nhập từ hoặc nhờ Claude gợi ý.</Card>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => {
              const pct = t.total ? Math.round((t.learned / t.total) * 100) : 0;
              return (
                <li key={t.id}>
                  <a
                    href={href({ name: 'topic', id: t.id })}
                    className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-5 transition hover:border-brand/40 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl" aria-hidden>
                        {t.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{t.name}</div>
                        {t.description && <div className="line-clamp-2 text-sm text-muted">{t.description}</div>}
                      </div>
                    </div>
                    <div className="mt-auto">
                      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                        <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-2 flex justify-between text-xs text-muted">
                        <span>
                          {t.learned}/{t.total} đã học
                        </span>
                        {t.due > 0 && <span className="font-medium text-brand">{t.due} thẻ hôm nay</span>}
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {creating && <NewTopic onClose={() => setCreating(false)} />}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <Card>
      <div className="text-sm text-muted">{label}</div>
      <div className="text-3xl font-bold">
        {value} {suffix && <span className="text-base font-medium text-muted">{suffix}</span>}
      </div>
    </Card>
  );
}

const EMOJIS = ['📚', '✈️', '🍽️', '🏥', '🛍️', '🏠', '⚽', '🎬', '💼', '🚆', '🌦️', '❤️'];

function NewTopic({ onClose }: { onClose: () => void }) {
  const { refresh } = useApp();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📚');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const topic = await api.createTopic({ name: name.trim(), emoji, description: description.trim() || undefined });
      await refresh();
      go({ name: 'topic', id: topic.id });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Chủ đề mới" onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tên chủ đề
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Đi khám bệnh, Phỏng vấn xin việc…"
            className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm font-medium">
          Biểu tượng
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Biểu tượng">
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                role="radio"
                aria-checked={emoji === e}
                onClick={() => setEmoji(e)}
                className={`h-10 w-10 rounded-lg text-xl ${emoji === e ? 'bg-brand-soft ring-2 ring-brand' : 'bg-white hover:bg-black/5'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Mô tả (không bắt buộc, giúp Claude gợi ý sát hơn)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="VD: nói chuyện với lễ tân khách sạn ở London"
            className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
          />
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()}>
            Tạo chủ đề
          </Button>
        </div>
      </form>
    </Modal>
  );
}

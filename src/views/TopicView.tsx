import { useCallback, useEffect, useState } from 'react';
import type { Item, Level, Topic } from '../../shared/types';
import { api } from '../api';
import { go, useApp } from '../App';
import { SpeakDrill } from '../components/SpeakDrill';
import { Button, Card, ErrorNote, ListenButton, Modal, Spinner } from '../ui';

const LEVELS: Level[] = ['A2', 'B1', 'B2', 'C1'];

function isIncomplete(i: Item) {
  return !i.meaningVi || i.examples.length < 2 || !i.ipa;
}

function dueLabel(item: Item): string {
  if (!item.srs) return 'Mới';
  const ms = new Date(item.srs.due).getTime() - Date.now();
  if (ms <= 0) return 'Cần ôn';
  const days = Math.round(ms / 86_400_000);
  if (days < 1) return `Ôn lại sau ${Math.max(1, Math.round(ms / 3_600_000))} giờ`;
  return `Ôn lại sau ${days} ngày`;
}

export function TopicView({ id }: { id: string }) {
  const { refresh, toast, state } = useApp();
  const [data, setData] = useState<{ topic: Topic; items: Item[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'add' | 'suggest' | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [drill, setDrill] = useState<{ text: string; vi?: string } | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [renaming, setRenaming] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.topic(id));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => void load(), [load]);

  const reload = useCallback(async () => {
    await Promise.all([load(), refresh()]);
  }, [load, refresh]);

  async function enrich(itemIds?: string[]) {
    setEnriching(true);
    try {
      const { updated } = await api.enrich(id, itemIds);
      toast(updated ? `Claude đã thêm nghĩa và ví dụ cho ${updated} mục.` : 'Các mục đã đủ ví dụ.');
      await reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setEnriching(false);
    }
  }

  async function removeTopic() {
    if (!data) return;
    if (!window.confirm(`Xoá chủ đề "${data.topic.name}" và toàn bộ ${data.items.length} mục bên trong? Không thể hoàn tác.`)) return;
    try {
      await api.deleteTopic(id);
      await refresh();
      go({ name: 'home' });
    } catch (err) {
      toast((err as Error).message);
    }
  }

  if (error) return <ErrorNote message={error} onRetry={load} />;
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> Đang tải chủ đề…
      </div>
    );
  }

  const { topic, items } = data;
  const incomplete = items.filter(isIncomplete).length;
  const summary = state.topics.find((t) => t.id === id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <a href="#/" className="text-sm text-muted hover:text-ink">
        ← Tất cả chủ đề
      </a>
      <header className="flex flex-wrap items-start gap-4">
        <span className="text-5xl" aria-hidden>
          {topic.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{topic.name}</h1>
          {topic.description && <p className="text-muted">{topic.description}</p>}
          <p className="mt-1 text-sm text-muted">
            {items.length} mục · {summary?.learned ?? 0} đã học · {summary?.due ?? 0} thẻ hôm nay
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setRenaming(true)}>
            ✏️ Sửa
          </Button>
          <Button variant="ghost" onClick={removeTopic}>
            🗑️ Xoá
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!summary?.due} onClick={() => go({ name: 'review', topicId: id })}>
          🔁 Ôn chủ đề này {summary?.due ? `(${summary.due})` : ''}
        </Button>
        <Button onClick={() => go({ name: 'talk', topicId: id })} disabled={!items.length}>
          💬 Nói chuyện theo chủ đề
        </Button>
        <Button onClick={() => setPanel(panel === 'add' ? null : 'add')}>✍️ Nhập từ của bạn</Button>
        <Button onClick={() => setPanel(panel === 'suggest' ? null : 'suggest')}>✨ Claude gợi ý từ</Button>
        {incomplete > 0 && (
          <Button onClick={() => enrich()} busy={enriching}>
            🧠 Tạo nghĩa & ví dụ ({incomplete})
          </Button>
        )}
      </div>
      {enriching && (
        <p className="-mt-3 text-sm text-muted">Claude đang viết ví dụ tự nhiên giọng Anh, thường mất 10–30 giây…</p>
      )}

      {panel === 'add' && <AddPanel topicId={id} onDone={async (ids) => {
        setPanel(null);
        await reload();
        if (ids.length) void enrich(ids);
      }} />}
      {panel === 'suggest' && <SuggestPanel topic={topic} onDone={async () => {
        setPanel(null);
        await reload();
      }} />}

      {items.length === 0 ? (
        <Card className="text-center text-muted">
          Chủ đề này chưa có từ nào. Hãy nhập từ của bạn hoặc nhờ Claude gợi ý.
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onDrill={(text, vi) => setDrill({ text, vi })}
              onEdit={() => setEditing(item)}
              onDelete={async () => {
                if (!window.confirm(`Xoá "${item.text}"?`)) return;
                await api.deleteItem(item.id).catch((e: Error) => toast(e.message));
                await reload();
              }}
            />
          ))}
        </ul>
      )}

      {drill && (
        <Modal title="Luyện nói" onClose={() => setDrill(null)}>
          <SpeakDrill target={drill.text} vi={drill.vi} />
        </Modal>
      )}
      {editing && <EditItem item={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {renaming && <EditTopic topic={topic} onClose={() => setRenaming(false)} onSaved={reload} />}
    </div>
  );
}

function ItemCard({
  item,
  onDrill,
  onEdit,
  onDelete,
}: {
  item: Item;
  onDrill: (text: string, vi?: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const status = dueLabel(item);
  return (
    <li className="rounded-2xl border border-line bg-white">
      <div className="flex items-center gap-3 p-4">
        <ListenButton text={item.text} />
        <ListenButton text={item.text} slow size="sm" />
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-semibold">{item.text}</span>
            {item.ipa && <span className="ipa text-sm text-muted">{item.ipa}</span>}
            {item.pos && <span className="text-xs text-muted italic">{item.pos}</span>}
          </div>
          <div className="text-sm text-muted">
            {item.meaningVi ?? <span className="italic">Chưa có nghĩa, bấm “Tạo nghĩa & ví dụ”.</span>}
          </div>
        </button>
        <span
          className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline ${
            status === 'Mới' ? 'bg-brand-soft text-brand' : status === 'Cần ôn' ? 'bg-warn-soft text-warn' : 'bg-good-soft text-good'
          }`}
        >
          {status}
        </span>
        <Button variant="soft" onClick={() => onDrill(item.text, item.meaningVi)}>
          🎙️ Nói thử
        </Button>
        <button className="px-1 text-muted" onClick={() => setOpen(!open)} aria-label={open ? 'Thu gọn' : 'Xem ví dụ'}>
          {open ? '▴' : '▾'}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-4">
          {item.definitionEn && <p className="text-sm">{item.definitionEn}</p>}
          {item.tip && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">
              <span className="font-medium">Mẹo phát âm: </span>
              {item.tip}
            </p>
          )}
          {item.examples.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {item.examples.map((ex, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ListenButton text={ex.en} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div>{ex.en}</div>
                    <div className="text-sm text-muted">{ex.vi}</div>
                  </div>
                  <Button variant="ghost" className="py-1!" onClick={() => onDrill(ex.en, ex.vi)}>
                    🎙️
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Chưa có ví dụ.</p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onEdit}>
              ✏️ Sửa
            </Button>
            <Button variant="ghost" onClick={onDelete}>
              🗑️ Xoá
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function AddPanel({ topicId, onDone }: { topicId: string; onDone: (newIds: string[]) => void }) {
  const { toast } = useApp();
  const [lines, setLines] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { added, skipped } = await api.addItems(topicId, lines);
      toast(
        `Đã thêm ${added.length} mục${skipped.length ? `, bỏ qua ${skipped.length} mục trùng` : ''}.${added.length ? ' Claude đang tạo ví dụ…' : ''}`,
      );
      onDone(added.map((a) => a.id));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mỗi dòng một từ hoặc cụm từ (tiếng Anh)
        <textarea
          autoFocus
          rows={5}
          value={lines}
          onChange={(e) => setLines(e.target.value)}
          placeholder={'fancy a cuppa?\nqueue\nI’m knackered'}
          className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
        />
      </label>
      <p className="text-xs text-muted">Sau khi thêm, Claude sẽ tự viết nghĩa tiếng Việt, phiên âm, mẹo phát âm và ví dụ.</p>
      {error && <ErrorNote message={error} />}
      <div>
        <Button variant="primary" onClick={submit} busy={busy} disabled={!lines.trim()}>
          Thêm vào chủ đề
        </Button>
      </div>
    </Card>
  );
}

function SuggestPanel({ topic, onDone }: { topic: Topic; onDone: () => void }) {
  const { state, toast } = useApp();
  const [count, setCount] = useState(8);
  const [level, setLevel] = useState<Level>(state.settings.level);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { added } = await api.suggest(topic.id, { count, level, hint: hint.trim() || undefined });
      toast(`Claude đã thêm ${added.length} mục mới cho “${topic.name}”.`);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Số lượng
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded-lg border border-line bg-white px-3 py-2">
            {[5, 8, 10, 15].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-sm font-medium">
          Trình độ
          <div className="flex gap-1" role="radiogroup" aria-label="Trình độ">
            {LEVELS.map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={level === l}
                onClick={() => setLevel(l)}
                className={`rounded-lg px-3 py-2 ${level === l ? 'bg-brand text-white' : 'border border-line bg-white'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium">
          Muốn tập trung vào gì? (không bắt buộc)
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="VD: cách từ chối lịch sự, từ lóng Anh…"
            className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
          />
        </label>
      </div>
      {error && <ErrorNote message={error} onRetry={submit} />}
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={submit} busy={busy}>
          ✨ Gợi ý {count} mục
        </Button>
        {busy && <span className="text-sm text-muted">Claude đang chọn từ hay dùng ở Anh và viết ví dụ…</span>}
      </div>
    </Card>
  );
}

function EditItem({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => Promise<void> }) {
  const [text, setText] = useState(item.text);
  const [meaningVi, setMeaningVi] = useState(item.meaningVi ?? '');
  const [ipa, setIpa] = useState(item.ipa ?? '');
  const [tip, setTip] = useState(item.tip ?? '');
  const [examples, setExamples] = useState(item.examples.map((e) => `${e.en} | ${e.vi}`).join('\n'));
  const [resetSrs, setResetSrs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    try {
      await api.updateItem(item.id, {
        text,
        meaningVi,
        ipa,
        tip,
        examples: examples
          .split('\n')
          .map((l) => l.split('|').map((s) => s.trim()))
          .filter(([en]) => en)
          .map(([en, vi = '']) => ({ en, vi })),
        resetSrs,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const field = 'rounded-lg border border-line bg-white px-3 py-2 font-normal';
  return (
    <Modal title="Sửa mục từ" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Từ / cụm từ
          <input value={text} onChange={(e) => setText(e.target.value)} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Nghĩa tiếng Việt
            <input value={meaningVi} onChange={(e) => setMeaningVi(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Phiên âm (IPA)
            <input value={ipa} onChange={(e) => setIpa(e.target.value)} className={`${field} ipa`} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Mẹo phát âm
          <textarea rows={2} value={tip} onChange={(e) => setTip(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Ví dụ (mỗi dòng: câu tiếng Anh | nghĩa tiếng Việt)
          <textarea rows={4} value={examples} onChange={(e) => setExamples(e.target.value)} className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={resetSrs} onChange={(e) => setResetSrs(e.target.checked)} />
          Học lại từ đầu (xoá lịch ôn của mục này)
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="primary" onClick={save} busy={busy} disabled={!text.trim()}>
            Lưu
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditTopic({ topic, onClose, onSaved }: { topic: Topic; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(topic.name);
  const [emoji, setEmoji] = useState(topic.emoji);
  const [description, setDescription] = useState(topic.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    try {
      await api.updateTopic(topic.id, { name, emoji, description });
      await onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  const field = 'rounded-lg border border-line bg-white px-3 py-2 font-normal';
  return (
    <Modal title="Sửa chủ đề" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Biểu tượng
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={`${field} text-center text-xl`} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tên
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Mô tả
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="primary" onClick={save} busy={busy} disabled={!name.trim()}>
            Lưu
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Spaced-repetition session. Each card is practised by ear or by mouth:
//  learn  – first meeting: hear it, read it, say it
//  listen – hear the British voice first, recall the meaning, then see it
//  speak  – see the Vietnamese meaning, say the English out loud, then compare

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PronounceResult, Rating, ReviewCard } from '../../shared/types';
import { api } from '../api';
import { go, useApp } from '../App';
import { speak, stopAudio } from '../audio';
import { RecordButton, SpeakDrill, useRecorder } from '../components/SpeakDrill';
import { Button, Card, ErrorNote, ListenButton, Spinner, scoreTone } from '../ui';

const RATINGS: { rating: Rating; label: string; hint: string; cls: string }[] = [
  { rating: 1, label: 'Quên', hint: 'Chưa nhớ ra', cls: 'border-bad/30 text-bad hover:bg-bad-soft' },
  { rating: 2, label: 'Khó', hint: 'Nhớ chật vật', cls: 'border-warn/30 text-warn hover:bg-warn-soft' },
  { rating: 3, label: 'Ổn', hint: 'Nhớ được', cls: 'border-good/30 text-good hover:bg-good-soft' },
  { rating: 4, label: 'Dễ', hint: 'Quá dễ', cls: 'border-brand/30 text-brand hover:bg-brand-soft' },
];

const MODE_LABEL = {
  learn: { icon: '🌱', title: 'Từ mới', hint: 'Nghe, đọc và nói theo vài lần.' },
  listen: { icon: '👂', title: 'Nghe & nhớ nghĩa', hint: 'Nghe giọng Anh, tự nhớ nghĩa rồi mới xem đáp án.' },
  speak: { icon: '🗣️', title: 'Nhìn nghĩa & nói', hint: 'Nói to cụm tiếng Anh, app sẽ nghe và so sánh.' },
} as const;

export function ReviewView({ topicId }: { topicId?: string }) {
  const { refresh, state } = useApp();
  const [queue, setQueue] = useState<ReviewCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [busy, setBusy] = useState(false);
  const total = useRef(0);

  const load = useCallback(async () => {
    try {
      const q = await api.queue(topicId);
      total.current = q.length;
      setQueue(q);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [topicId]);

  useEffect(() => void load(), [load]);
  useEffect(() => () => stopAudio(), []);

  async function grade(card: ReviewCard, rating: Rating, score?: number) {
    setBusy(true);
    try {
      const next = await api.grade({ itemId: card.item.id, rating, mode: card.mode, score });
      setDone((d) => ({ ...d, [rating]: d[rating] + 1 }));
      setQueue((q) => {
        const rest = (q ?? []).slice(1);
        // "Quên" brings the card back later in this same session.
        if (rating === 1) {
          const at = Math.min(rest.length, 3);
          return [...rest.slice(0, at), next, ...rest.slice(at)];
        }
        return rest;
      });
      void refresh(); // keep the sidebar badge and home counts in step
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const topic = topicId ? state.topics.find((t) => t.id === topicId) : undefined;
  const reviewed = done[1] + done[2] + done[3] + done[4];

  if (error && !queue) return <ErrorNote message={error} onRetry={load} />;
  if (!queue) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> Đang chuẩn bị thẻ…
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="text-5xl">{reviewed ? '🎉' : '☕'}</div>
          <h1 className="text-xl font-bold">{reviewed ? 'Xong lượt ôn!' : 'Không có thẻ nào cần ôn lúc này'}</h1>
          {reviewed > 0 ? (
            <p className="text-muted">
              Bạn đã ôn {reviewed} lượt: {done[3] + done[4]} nhớ tốt, {done[2]} hơi khó, {done[1]} cần học lại. Lịch ôn đã được
              xếp lại để bạn gặp lại từng từ đúng lúc sắp quên.
            </p>
          ) : (
            <p className="text-muted">Hãy thêm từ mới vào một chủ đề, hoặc quay lại sau.</p>
          )}
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              onClick={async () => {
                await refresh();
                go(topicId ? { name: 'topic', id: topicId } : { name: 'home' });
              }}
            >
              {topicId ? 'Về chủ đề' : 'Về trang chính'}
            </Button>
            <Button onClick={() => go({ name: 'talk', topicId })}>💬 Nói chuyện để dùng từ vừa học</Button>
          </div>
        </Card>
      </div>
    );
  }

  const card = queue[0];
  const progress = total.current ? Math.min(100, Math.round((reviewed / Math.max(total.current, reviewed + queue.length)) * 100)) : 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-4">
        <button
          className="text-sm text-muted hover:text-ink"
          onClick={async () => {
            await refresh();
            go(topicId ? { name: 'topic', id: topicId } : { name: 'home' });
          }}
        >
          ✕ Dừng
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm text-muted">
          còn {queue.length}
          {topic ? ` · ${topic.emoji} ${topic.name}` : ''}
        </span>
      </div>
      {error && <ErrorNote message={error} />}
      <CardView key={`${card.item.id}-${reviewed}`} card={card} busy={busy} onGrade={(r, s) => grade(card, r, s)} />
    </div>
  );
}

function CardView({ card, busy, onGrade }: { card: ReviewCard; busy: boolean; onGrade: (r: Rating, score?: number) => void }) {
  const { item, mode } = card;
  const [revealed, setRevealed] = useState(mode === 'learn');
  const [result, setResult] = useState<PronounceResult | null>(null);
  const example = item.examples[0];
  const m = MODE_LABEL[mode];

  // Listening cards start by playing the phrase.
  useEffect(() => {
    if (mode === 'listen' || mode === 'learn') {
      const t = window.setTimeout(() => void speak(item.text, { key: `${item.text}|n` }), 250);
      return () => window.clearTimeout(t);
    }
  }, [item.text, mode]);

  const reveal = useCallback(() => {
    setRevealed(true);
    if (mode === 'speak') void speak(item.text, { key: `${item.text}|n` });
  }, [item.text, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      if (e.key === ' ' && !revealed) {
        e.preventDefault();
        reveal();
      } else if (revealed && !busy && ['1', '2', '3', '4'].includes(e.key)) {
        onGrade(Number(e.key) as Rating, result?.score);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, busy, reveal, onGrade, result]);

  const suggested = result?.suggested;

  return (
    <Card className="flex flex-col gap-5 p-7">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span aria-hidden>{m.icon}</span>
        <span className="font-medium text-ink">{m.title}</span>
        <span>· {m.hint}</span>
      </div>

      {/* Prompt side */}
      {mode === 'listen' && !revealed && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex gap-3">
            <ListenButton text={item.text} size="lg" />
            <ListenButton text={item.text} slow size="lg" />
          </div>
          <p className="text-muted">Nghe xong, bạn có nhớ nghĩa không? Thử nói to theo.</p>
        </div>
      )}

      {mode === 'speak' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-brand-soft/60 px-5 py-4">
            <div className="text-sm text-muted">Nói bằng tiếng Anh:</div>
            <div className="text-2xl font-semibold">{item.meaningVi ?? item.definitionEn ?? '(chưa có nghĩa)'}</div>
            {item.definitionEn && item.meaningVi && <div className="mt-1 text-sm text-muted">{item.definitionEn}</div>}
          </div>
          {!revealed && (
            <SpeakOnly
              target={item.text}
              onResult={(r) => {
                setResult(r);
                setRevealed(true);
              }}
            />
          )}
        </div>
      )}

      {/* Answer side */}
      {revealed && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <ListenButton text={item.text} />
            <ListenButton text={item.text} slow size="sm" />
            <span className="text-3xl font-bold">{item.text}</span>
            {item.ipa && <span className="ipa text-lg text-muted">{item.ipa}</span>}
          </div>
          {mode !== 'speak' && item.meaningVi && <p className="text-lg">{item.meaningVi}</p>}
          {item.tip && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">
              <span className="font-medium">Mẹo phát âm: </span>
              {item.tip}
            </p>
          )}
          {result && mode === 'speak' && (
            <p className="text-sm">
              App nghe được <span className={`font-bold ${scoreTone(result.score)}`}>{result.score}%</span>: “{result.heard}”
            </p>
          )}
          {example && (
            <div className="rounded-xl border border-line px-4 py-3">
              <div className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Nói nhại theo câu ví dụ</div>
              <div className="flex items-start gap-2">
                <ListenButton text={example.en} size="sm" />
                <div>
                  <div className="text-lg">{example.en}</div>
                  <div className="text-sm text-muted">{example.vi}</div>
                </div>
              </div>
            </div>
          )}
          {(mode === 'learn' || mode === 'listen') && (
            <details className="rounded-xl border border-line px-4 py-3" open={mode === 'learn'}>
              <summary className="cursor-pointer text-sm font-medium">🎙️ Nói thử và để app nghe</summary>
              <div className="mt-3">
                <SpeakDrill target={item.text} compact onResult={setResult} />
              </div>
            </details>
          )}
        </div>
      )}

      {/* Actions */}
      {!revealed ? (
        <div className="flex justify-center">
          <Button variant={mode === 'listen' ? 'primary' : 'ghost'} onClick={reveal}>
            {mode === 'listen' ? 'Hiện đáp án' : 'Bỏ qua nói, xem đáp án'} <kbd className="ml-1 text-xs opacity-70">Space</kbd>
          </Button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-center text-sm text-muted">
            {mode === 'learn' ? 'Bạn thấy từ này thế nào?' : 'Bạn nhớ tốt đến đâu?'}
            {suggested && ' App gợi ý theo kết quả nói ở viền đậm.'}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.rating}
                disabled={busy}
                onClick={() => onGrade(r.rating, result?.score)}
                className={`flex flex-col items-center rounded-xl border bg-white px-2 py-3 transition disabled:opacity-50 ${r.cls} ${
                  suggested === r.rating ? 'border-2 border-current shadow-sm' : ''
                }`}
              >
                <span className="font-semibold">
                  {r.label} <kbd className="text-xs opacity-60">{r.rating}</kbd>
                </span>
                <span className="text-xs text-muted">{card.intervals[r.rating]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Speaking prompt for "speak" cards: record without hearing the model first, then reveal. */
function SpeakOnly({ target, onResult }: { target: string; onResult: (r: PronounceResult) => void }) {
  const rec = useRecorder();
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <RecordButton
        phase={rec.phase}
        onStart={rec.start}
        onStop={async () => {
          const out = await rec.stop(target);
          if (out?.result) onResult(out.result);
        }}
        label="Nhấn rồi nói"
      />
      {rec.error && <ErrorNote message={rec.error} />}
    </div>
  );
}

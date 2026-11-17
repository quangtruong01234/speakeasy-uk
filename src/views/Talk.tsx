// Spoken role-play with the Claude tutor. The learner speaks (or types); the tutor
// answers in a British voice and gives gentle corrections the learner can drill.

import { useEffect, useRef, useState } from 'react';
import type { TalkReply, TalkTurn } from '../../shared/types';
import { api } from '../api';
import { useApp } from '../App';
import { speak, stopAudio } from '../audio';
import { RecordButton, SpeakDrill, useRecorder } from '../components/SpeakDrill';
import { Button, Card, ErrorNote, ListenButton, Modal, Spinner } from '../ui';

const PRESETS = [
  { emoji: '☕', label: 'Gọi đồ ở quán cà phê', scenario: 'Ordering at a busy café in London. You are the barista.' },
  { emoji: '🏨', label: 'Nhận phòng khách sạn', scenario: 'Checking in at a small hotel in Edinburgh. You are the receptionist.' },
  { emoji: '🚆', label: 'Hỏi đường ở ga tàu', scenario: 'Asking for help at a train station in Manchester. You are a friendly local.' },
  { emoji: '👋', label: 'Làm quen đồng nghiệp', scenario: 'Meeting a new colleague in the office kitchen on a Monday morning. You are the colleague.' },
  { emoji: '🩺', label: 'Đặt lịch khám bác sĩ', scenario: 'Phoning a GP surgery to book an appointment. You are the receptionist.' },
  { emoji: '💬', label: 'Nói chuyện tự do', scenario: 'A relaxed friendly chat about everyday life, hobbies and plans.' },
];

type Turn = TalkTurn & { reply?: TalkReply };

export function TalkView({ topicId }: { topicId?: string }) {
  const { state } = useApp();
  const topic = topicId ? state.topics.find((t) => t.id === topicId) : undefined;
  const [scenario, setScenario] = useState<string | null>(
    topic ? `Everyday conversation about "${topic.name}"${topic.description ? ` (${topic.description})` : ''}. Play a natural role that fits.` : null,
  );
  const [custom, setCustom] = useState('');

  if (!scenario) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <header>
          <h1 className="text-2xl font-bold">Nói chuyện với tutor 💬</h1>
          <p className="text-muted">
            Chọn một tình huống. Tutor nói giọng Anh, bạn trả lời bằng giọng nói; sau mỗi câu tutor sẽ khen và chỉ chỗ nên nói tự
            nhiên hơn.
          </p>
        </header>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => (
            <li key={p.label}>
              <button
                onClick={() => setScenario(p.scenario)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-brand/40"
              >
                <span className="text-3xl" aria-hidden>
                  {p.emoji}
                </span>
                <span className="font-medium">{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {state.topics.length > 0 && (
          <Card>
            <h2 className="mb-2 font-semibold">Theo chủ đề đang học (tutor sẽ cố dùng các từ trong đó)</h2>
            <div className="flex flex-wrap gap-2">
              {state.topics.map((t) => (
                <a key={t.id} href={`#/talk?topic=${t.id}`} className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-brand-soft">
                  {t.emoji} {t.name}
                </a>
              ))}
            </div>
          </Card>
        )}
        <Card>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim()) setScenario(custom.trim());
            }}
          >
            <label className="font-semibold" htmlFor="custom-scenario">
              Tự mô tả tình huống
            </label>
            <div className="flex gap-2">
              <input
                id="custom-scenario"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="VD: trả lại đôi giày bị lỗi ở cửa hàng"
                className="flex-1 rounded-lg border border-line bg-white px-3 py-2"
              />
              <Button variant="primary" type="submit" disabled={!custom.trim()}>
                Bắt đầu
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return <Conversation scenario={scenario} topicId={topicId} title={topic ? `${topic.emoji} ${topic.name}` : undefined} onExit={() => setScenario(null)} />;
}

function Conversation({ scenario, topicId, title, onExit }: { scenario: string; topicId?: string; title?: string; onExit: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [drill, setDrill] = useState<string | null>(null);
  const [showVi, setShowVi] = useState(false);
  const rec = useRecorder();
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  async function ask(history: Turn[]) {
    setThinking(true);
    setError(null);
    try {
      const reply = await api.talk({
        scenario,
        topicId,
        history: history.map(({ role, text }) => ({ role, text })),
      });
      setTurns((t) => {
        // Attach feedback to the learner turn it is about.
        const copy = [...t];
        const last = copy[copy.length - 1];
        if (last?.role === 'learner') copy[copy.length - 1] = { ...last, reply };
        return [...copy, { role: 'tutor', text: reply.reply, reply }];
      });
      void speak(reply.reply, { key: `tutor-${history.length}` });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ask([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopAudio(), []);
  // Braces matter: newer Chromium returns a Promise from scrollIntoView, which React
  // would otherwise treat as the effect's cleanup function and crash on unmount.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, thinking]);

  function send(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    const next: Turn[] = [...turns, { role: 'learner', text: clean }];
    setTurns(next);
    setTyped('');
    void ask(next);
  }

  async function finishRecording() {
    const out = await rec.stop();
    if (out?.text) send(out.text);
    rec.setPhase('idle');
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <button className="text-sm text-muted hover:text-ink" onClick={onExit}>
          ← Đổi tình huống
        </button>
        <div className="min-w-0 flex-1 truncate text-sm text-muted">{title ?? scenario}</div>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={showVi} onChange={(e) => setShowVi(e.target.checked)} />
          Hiện nghĩa tiếng Việt
        </label>
      </div>

      <ol className="flex flex-col gap-3" aria-live="polite">
        {turns.map((t, i) =>
          t.role === 'tutor' ? (
            <li key={i} className="flex max-w-[85%] flex-col gap-1 self-start">
              <div className="flex items-start gap-2 rounded-2xl rounded-tl-sm border border-line bg-white px-4 py-3">
                <span aria-hidden>🧑‍🏫</span>
                <div className="flex-1">
                  <p className="text-lg">{t.text}</p>
                  {showVi && t.reply?.replyVi && <p className="mt-1 text-sm text-muted">{t.reply.replyVi}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <ListenButton text={t.text} size="sm" />
                  <ListenButton text={t.text} slow size="sm" />
                </div>
              </div>
            </li>
          ) : (
            <li key={i} className="flex max-w-[85%] flex-col items-end gap-2 self-end">
              <div className="rounded-2xl rounded-tr-sm bg-brand px-4 py-3 text-lg text-white">{t.text}</div>
              {t.reply && <Feedback reply={t.reply} onDrill={setDrill} />}
            </li>
          ),
        )}
        {thinking && (
          <li className="flex items-center gap-2 self-start text-muted">
            <Spinner /> Tutor đang trả lời…
          </li>
        )}
      </ol>
      <div ref={bottom} />

      {error && <ErrorNote message={error} onRetry={() => ask(turns)} />}

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-paper py-4">
        <div className="flex items-center gap-3">
          <RecordButton phase={rec.phase} onStart={rec.start} onStop={finishRecording} label="Nhấn để trả lời" />
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(typed);
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="…hoặc gõ câu trả lời"
              aria-label="Gõ câu trả lời"
              className="flex-1 rounded-lg border border-line bg-white px-3 py-2"
            />
            <Button type="submit" disabled={!typed.trim() || thinking}>
              Gửi
            </Button>
          </form>
        </div>
        {rec.error && <ErrorNote message={rec.error} />}
      </div>

      {drill && (
        <Modal title="Luyện câu này" onClose={() => setDrill(null)}>
          <SpeakDrill target={drill} />
        </Modal>
      )}
    </div>
  );
}

function Feedback({ reply, onDrill }: { reply: TalkReply; onDrill: (s: string) => void }) {
  const { praiseVi, corrections, pronunciation } = reply.feedback;
  if (!praiseVi && !corrections.length && !pronunciation.length) return null;
  return (
    <div className="w-full rounded-xl border border-good/20 bg-good-soft/60 px-4 py-3 text-sm">
      {praiseVi && <p>👍 {praiseVi}</p>}
      {corrections.map((c, i) => (
        <div key={i} className="mt-2 border-t border-good/15 pt-2">
          <p>
            <span className="text-muted line-through">{c.said}</span> → <span className="font-semibold">{c.better}</span>
          </p>
          <p className="text-muted">{c.noteVi}</p>
          <div className="mt-1 flex gap-1.5">
            <ListenButton text={c.better} size="sm" />
            <Button variant="ghost" className="py-1!" onClick={() => onDrill(c.better)}>
              🎙️ Luyện câu này
            </Button>
          </div>
        </div>
      ))}
      {pronunciation.map((p, i) => (
        <div key={`p${i}`} className="mt-2 flex items-start gap-2 border-t border-good/15 pt-2">
          <ListenButton text={p.word} size="sm" />
          <div>
            <span className="font-semibold">{p.word}</span> <span className="ipa text-muted">{p.ipa}</span>
            <p className="text-muted">{p.tipVi}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

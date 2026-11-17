// Record yourself saying a target sentence, see which words the recogniser heard,
// compare with the British model voice, and ask the Claude tutor for tips.

import { useEffect, useRef, useState } from 'react';
import type { CoachReply, PronounceResult } from '../../shared/types';
import { api } from '../api';
import { MicError, playBlobUrl, startRecording, stopAudio } from '../audio';
import { Button, ErrorNote, ListenButton, Spinner, scoreTone, usePlaying } from '../ui';

type Phase = 'idle' | 'recording' | 'checking' | 'done';

export function useRecorder() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const [mineUrl, setMineUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      rec.current?.cancel();
    },
    [],
  );
  useEffect(() => () => void (mineUrl && URL.revokeObjectURL(mineUrl)), [mineUrl]);

  async function start() {
    setError(null);
    try {
      rec.current = await startRecording();
      setPhase('recording');
    } catch (err) {
      setError(err instanceof MicError ? err.message : `Không ghi âm được: ${(err as Error).message}`);
      setPhase('idle');
    }
  }

  /** Stops and transcribes; returns null when nothing usable was recorded. */
  async function stop(target?: string): Promise<{ text: string; result: PronounceResult | null } | null> {
    const r = rec.current;
    if (!r) return null;
    rec.current = null;
    setPhase('checking');
    try {
      const recording = await r.stop();
      setMineUrl(recording.url);
      if (recording.seconds < 0.4) {
        setError('Bản ghi quá ngắn. Nhấn giữ lâu hơn một chút hoặc nhấn lần nữa khi nói xong.');
        setPhase('idle');
        return null;
      }
      const out = await api.stt(recording.pcm, target);
      if (!out.text) {
        setError('Mình chưa nghe thấy tiếng nói. Hãy nói to và gần micro hơn một chút.');
        setPhase('idle');
        return null;
      }
      setPhase('done');
      return out;
    } catch (err) {
      setError((err as Error).message);
      setPhase('idle');
      return null;
    }
  }

  return { phase, setPhase, error, setError, start, stop, mineUrl };
}

export function RecordButton({
  phase,
  onStart,
  onStop,
  label = 'Nhấn để nói',
}: {
  phase: Phase;
  onStart: () => void;
  onStop: () => void;
  label?: string;
}) {
  const recording = phase === 'recording';
  const checking = phase === 'checking';
  return (
    <button
      type="button"
      onClick={recording ? onStop : onStart}
      disabled={checking}
      aria-pressed={recording}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-3 font-semibold text-white transition disabled:opacity-60 ${
        recording ? 'recording bg-bad' : 'bg-brand hover:bg-brand/90'
      }`}
    >
      {checking ? <Spinner /> : <span aria-hidden>{recording ? '■' : '🎙️'}</span>}
      {checking ? 'Đang nghe lại…' : recording ? 'Nhấn khi nói xong' : label}
    </button>
  );
}

export function WordLine({ result }: { result: PronounceResult }) {
  return (
    <p className="flex flex-wrap gap-x-1.5 gap-y-1 text-xl leading-relaxed">
      {result.words.map((w, i) => (
        <span
          key={i}
          title={w.status === 'sub' ? `App nghe thành "${w.heard}"` : w.status === 'miss' ? 'App không nghe thấy từ này' : 'Rõ'}
          className={`rounded px-1 ${
            w.status === 'ok'
              ? 'text-good'
              : w.status === 'sub'
                ? 'bg-warn-soft text-warn underline decoration-wavy'
                : 'bg-bad-soft text-bad line-through'
          }`}
        >
          {w.text}
        </span>
      ))}
    </p>
  );
}

export function SpeakDrill({
  target,
  vi,
  onResult,
  compact,
}: {
  target: string;
  vi?: string;
  /** Called with each new pronunciation result (used by Review to suggest a grade). */
  onResult?: (r: PronounceResult) => void;
  compact?: boolean;
}) {
  const rec = useRecorder();
  const [result, setResult] = useState<PronounceResult | null>(null);
  const [coach, setCoach] = useState<CoachReply | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const playing = usePlaying();

  useEffect(() => () => stopAudio(), []);

  async function finish() {
    const out = await rec.stop(target);
    if (out?.result) {
      setResult(out.result);
      setCoach(null);
      setCoachError(null);
      onResult?.(out.result);
    }
  }

  async function askCoach() {
    if (!result) return;
    setCoachBusy(true);
    setCoachError(null);
    try {
      setCoach(await api.coach({ target, heard: result.heard, words: result.words }));
    } catch (err) {
      setCoachError((err as Error).message);
    } finally {
      setCoachBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!compact && (
        <div>
          <p className="text-2xl font-semibold">{target}</p>
          {vi && <p className="mt-1 text-muted">{vi}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ListenButton text={target} label="Nghe mẫu" />
        <ListenButton text={target} slow label="Chậm" />
        <RecordButton phase={rec.phase} onStart={rec.start} onStop={finish} />
        {rec.mineUrl && rec.phase !== 'recording' && (
          <Button variant="ghost" onClick={() => void playBlobUrl(rec.mineUrl!)}>
            {playing === 'mine' ? '■' : '▶'} Nghe lại giọng mình
          </Button>
        )}
      </div>

      {rec.error && <ErrorNote message={rec.error} />}

      {result && (
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted">App nghe được</span>
            <span className={`text-2xl font-bold ${scoreTone(result.score)}`}>{result.score}%</span>
          </div>
          <WordLine result={result} />
          <p className="mt-2 text-sm text-muted">
            Nghe thành: “{result.heard}”
            {result.extra.length > 0 && <> · thừa: {result.extra.join(', ')}</>}
          </p>
          <p className="mt-1 text-xs text-muted">
            Xanh = rõ · cam = nghe thành từ khác · đỏ = bị mất. Điểm dựa trên việc máy nhận dạng có nghe đúng từ hay không, không phải chấm âm vị.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.score < 100 && (
              <Button onClick={askCoach} busy={coachBusy}>
                🧑‍🏫 Nhờ tutor chỉ cách sửa
              </Button>
            )}
            {result.score === 100 && <span className="text-sm font-medium text-good">Tuyệt! Nghe rất rõ 👏</span>}
          </div>
        </div>
      )}

      {coachBusy && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Tutor đang xem bạn nói…
        </p>
      )}
      {coachError && <ErrorNote message={coachError} onRetry={askCoach} />}
      {coach && (
        <div className="rounded-xl border border-brand/20 bg-brand-soft/60 p-4">
          <p className="font-medium">{coach.summaryVi}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {coach.tips.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <ListenButton text={t.word} size="sm" />
                <div>
                  <span className="font-semibold">{t.word}</span> <span className="ipa text-muted">{t.ipa}</span>
                  <p className="text-sm">{t.tipVi}</p>
                </div>
              </li>
            ))}
          </ul>
          {coach.drill && (
            <div className="mt-3 flex items-center gap-2 border-t border-brand/15 pt-3 text-sm">
              <span className="text-muted">Luyện thêm:</span>
              <span className="font-medium">{coach.drill}</span>
              <ListenButton text={coach.drill} size="sm" />
              <ListenButton text={coach.drill} slow size="sm" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

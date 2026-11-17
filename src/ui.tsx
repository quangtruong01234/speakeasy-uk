// Small shared UI pieces.

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { onPlaying, speak, stopAudio } from './audio';

type Variant = 'primary' | 'ghost' | 'soft' | 'danger';

export function Button({
  variant = 'soft',
  className = '',
  busy,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-brand text-white hover:bg-brand/90 disabled:bg-brand/50',
    soft: 'bg-white border border-line text-ink hover:bg-brand-soft disabled:opacity-50',
    ghost: 'text-muted hover:text-ink hover:bg-black/5 disabled:opacity-50',
    danger: 'bg-white border border-bad/30 text-bad hover:bg-bad-soft disabled:opacity-50',
  };
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${styles[variant]} ${className}`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function usePlaying(): string | null {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => onPlaying(setKey), []);
  return key;
}

/** Round play button; second click stops. */
export function ListenButton({
  text,
  slow,
  label,
  size = 'md',
  className = '',
}: {
  text: string;
  slow?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const key = `${text}|${slow ? 's' : 'n'}`;
  const playing = usePlaying() === key;
  const dim = { sm: 'h-8 min-w-8 text-sm', md: 'h-10 min-w-10', lg: 'h-14 min-w-14 text-xl' }[size];
  return (
    <button
      type="button"
      title={slow ? 'Nghe chậm' : 'Nghe'}
      aria-label={label ?? (slow ? `Nghe chậm: ${text}` : `Nghe: ${text}`)}
      onClick={(e) => {
        e.stopPropagation();
        if (playing) stopAudio();
        else void speak(text, { slow, key });
      }}
      className={`inline-flex items-center justify-center gap-1 rounded-full px-2 transition ${dim} ${
        playing ? 'bg-brand text-white' : 'bg-brand-soft text-brand hover:bg-brand hover:text-white'
      } ${className}`}
    >
      {playing ? '■' : slow ? '🐢' : '🔊'}
      {label && <span className="pr-1 text-sm font-medium">{label}</span>}
    </button>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`mt-8 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} rounded-2xl bg-paper shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded-lg px-2 py-1 text-muted hover:bg-black/5" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-5 ${className}`}>{children}</div>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-bad/20 bg-bad-soft px-4 py-3 text-sm text-bad">
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button className="font-medium underline" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function scoreTone(score: number): string {
  if (score >= 90) return 'text-good';
  if (score >= 70) return 'text-warn';
  return 'text-bad';
}

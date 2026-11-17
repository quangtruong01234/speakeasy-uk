import { Component, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState, Health, Settings } from '../shared/types';
import { api } from './api';
import { setVoice, stopAudio } from './audio';
import { Home } from './views/Home';
import { ReviewView } from './views/Review';
import { SettingsView } from './views/Settings';
import { TalkView } from './views/Talk';
import { TopicView } from './views/TopicView';
import { ErrorNote, Spinner } from './ui';

// ---------- hash router ----------

export type Route =
  | { name: 'home' }
  | { name: 'topic'; id: string }
  | { name: 'review'; topicId?: string }
  | { name: 'talk'; topicId?: string }
  | { name: 'settings' };

function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'topic' && parts[1]) return { name: 'topic', id: parts[1] };
  if (parts[0] === 'review') return { name: 'review', topicId: q.get('topic') ?? undefined };
  if (parts[0] === 'talk') return { name: 'talk', topicId: q.get('topic') ?? undefined };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'topic':
      return `#/topic/${route.id}`;
    case 'review':
      return route.topicId ? `#/review?topic=${route.topicId}` : '#/review';
    case 'talk':
      return route.topicId ? `#/talk?topic=${route.topicId}` : '#/talk';
    case 'settings':
      return '#/settings';
  }
}

export function go(route: Route): void {
  window.location.hash = href(route);
}

// ---------- app context ----------

type Ctx = {
  state: AppState;
  refresh: () => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
  health: Health | null;
  checkHealth: () => Promise<void>;
  toast: (message: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  useEffect(() => {
    const onHash = () => {
      stopAudio();
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await api.state();
      setState(s);
      setVoice(s.settings.voice, s.settings.rate);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      setHealth(await api.health());
    } catch {
      /* banner stays hidden; the state error already explains */
    }
  }, []);

  // The data file can change outside the app (scripts/import-words.mjs from a Claude Code
  // session), so re-read it on navigation and whenever the window regains focus.
  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener('hashchange', onChange);
    window.addEventListener('focus', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [refresh]);

  useEffect(() => {
    void refresh();
    void checkHealth();
    // Start loading the speech recogniser early so the first recording is fast.
    api.warmupStt().catch(() => undefined);
  }, [refresh, checkHealth]);

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const settings = await api.saveSettings(patch);
      setVoice(settings.voice, settings.rate);
      setState((s) => (s ? { ...s, settings } : s));
    },
    [],
  );

  const ctx = useMemo<Ctx | null>(
    () => (state ? { state, refresh, updateSettings, health, checkHealth, toast } : null),
    [state, refresh, updateSettings, health, checkHealth, toast],
  );

  return (
    <div className="flex min-h-full">
      <Sidebar route={route} dueNow={state ? state.stats.dueNow + state.stats.newToday : 0} />
      <main className="min-w-0 flex-1 px-8 py-7">
        {health && !health.claude.ok && (
          <div className="mb-5">
            <ErrorNote
              message={`Chưa gọi được Claude Code nên các tính năng tạo ví dụ, gợi ý từ, tutor sẽ tạm tắt. Chi tiết: ${health.claude.detail}`}
              onRetry={checkHealth}
            />
          </div>
        )}
        {error && !state && <ErrorNote message={error} onRetry={refresh} />}
        {!state && !error && (
          <div className="flex items-center gap-2 text-muted">
            <Spinner /> Đang mở dữ liệu…
          </div>
        )}
        {ctx && (
          <AppCtx.Provider value={ctx}>
            <ViewBoundary key={href(route)}>
              <View route={route} />
            </ViewBoundary>
          </AppCtx.Provider>
        )}
      </main>
      <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex flex-col items-end gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Keeps a crash in one screen from blanking the whole window; navigating away resets it. */
class ViewBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('View crashed:', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorNote
        message={`Màn hình này gặp lỗi: ${this.state.error.message}`}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}

function View({ route }: { route: Route }): ReactNode {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'topic':
      return <TopicView key={route.id} id={route.id} />;
    case 'review':
      return <ReviewView key={route.topicId ?? 'all'} topicId={route.topicId} />;
    case 'talk':
      return <TalkView key={route.topicId ?? 'free'} topicId={route.topicId} />;
    case 'settings':
      return <SettingsView />;
  }
}

function Sidebar({ route, dueNow }: { route: Route; dueNow: number }) {
  const links: { label: string; icon: string; to: Route; active: boolean; badge?: number }[] = [
    { label: 'Trang chính', icon: '🏠', to: { name: 'home' }, active: route.name === 'home' || route.name === 'topic' },
    { label: 'Ôn tập', icon: '🔁', to: { name: 'review' }, active: route.name === 'review', badge: dueNow },
    { label: 'Nói chuyện', icon: '💬', to: { name: 'talk' }, active: route.name === 'talk' },
    { label: 'Cài đặt', icon: '⚙️', to: { name: 'settings' }, active: route.name === 'settings' },
  ];
  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-white/60 px-3 py-6">
      <a href="#/" className="mb-8 px-3">
        <div className="text-lg font-bold text-brand">SpeakEasy UK</div>
        <div className="text-xs text-muted">Nghe & nói tiếng Anh giọng Anh</div>
      </a>
      <ul className="flex flex-col gap-1">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={href(l.to)}
              aria-current={l.active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                l.active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-black/5'
              }`}
            >
              <span aria-hidden>{l.icon}</span>
              <span className="flex-1">{l.label}</span>
              {!!l.badge && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white" aria-label={`${l.badge} thẻ cần ôn`}>
                  {l.badge}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

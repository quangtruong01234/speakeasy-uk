// Types shared by the local API (server/) and the UI (src/).

export type Example = { en: string; vi: string };

/** FSRS card state, with dates serialised as ISO strings. */
export type SrsCard = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review?: string;
};

export type Item = {
  id: string;
  topicId: string;
  text: string;
  kind: 'word' | 'phrase';
  ipa?: string;
  pos?: string;
  meaningVi?: string;
  definitionEn?: string;
  examples: Example[];
  /** Pronunciation tip, in Vietnamese. */
  tip?: string;
  createdAt: string;
  /** null until the learner has studied the item once. */
  srs: SrsCard | null;
};

export type Topic = {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  createdAt: string;
};

export type ReviewMode = 'learn' | 'listen' | 'speak';
export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export type ReviewLog = {
  itemId: string;
  at: string;
  rating: Rating;
  mode: ReviewMode;
  score?: number;
};

export type Level = 'A2' | 'B1' | 'B2' | 'C1';

export type Settings = {
  voice: string;
  /** Speaking speed multiplier, 1 = natural. */
  rate: number;
  /** Claude Code model alias used for tutor calls. */
  model: string;
  newPerDay: number;
  level: Level;
};

export type DB = {
  version: 1;
  topics: Topic[];
  items: Item[];
  logs: ReviewLog[];
  settings: Settings;
};

// ---- API payloads ----

export type TopicSummary = Topic & {
  total: number;
  learned: number;
  due: number;
  incomplete: number;
};

export type Stats = {
  dueNow: number;
  newToday: number;
  reviewedToday: number;
  streak: number;
  learned: number;
  total: number;
  nextDue: string | null;
};

export type AppState = { topics: TopicSummary[]; stats: Stats; settings: Settings };

export type ReviewCard = {
  item: Item;
  mode: ReviewMode;
  /** Human-readable next interval for each rating, e.g. { 1: '1 phút', 3: '2 ngày' }. */
  intervals: Record<Rating, string>;
};

export type WordResult = {
  text: string;
  status: 'ok' | 'sub' | 'miss';
  /** What was heard in place of this word, when status is 'sub'. */
  heard?: string;
};

export type PronounceResult = {
  /** 0–100: share of target words that were heard. */
  score: number;
  heard: string;
  words: WordResult[];
  extra: string[];
  suggested: Rating;
};

export type CoachTip = { word: string; ipa: string; tipVi: string };
export type CoachReply = { summaryVi: string; tips: CoachTip[]; drill: string };

export type TalkTurn = { role: 'tutor' | 'learner'; text: string };
export type TalkCorrection = { said: string; better: string; noteVi: string };
export type TalkReply = {
  reply: string;
  replyVi: string;
  feedback: {
    praiseVi: string;
    corrections: TalkCorrection[];
    pronunciation: CoachTip[];
  };
};

export type VoiceInfo = { id: string; name: string; gender: 'Female' | 'Male'; noteVi: string };

export type Health = {
  claude: { ok: boolean; detail: string };
  stt: { state: 'idle' | 'loading' | 'ready' | 'error'; detail: string };
  dataDir: string;
};

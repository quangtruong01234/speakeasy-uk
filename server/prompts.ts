// Prompts, JSON schemas and output clean-up for every tutor task.
// Builders and normalisers are pure, so tests/prompts.test.ts can cover them.

import type {
  CoachReply,
  CoachTip,
  Example,
  Item,
  Level,
  TalkCorrection,
  TalkReply,
  TalkTurn,
  WordResult,
} from '../shared/types';

// Kept ASCII: it travels as a command-line argument.
export const SYSTEM =
  'You are a warm, encouraging British English speaking tutor for a Vietnamese learner. ' +
  'Use British spelling and everyday spoken British English (UK vocabulary, RP-style IPA). ' +
  'Vietnamese text must be natural, friendly Vietnamese with full diacritics. ' +
  'Answer only with the requested JSON.';

const STYLE_RULES = `Rules for every item:
- "ipa": British (RP) IPA between slashes, with stress marks, e.g. /ˈkʌpə/. For phrases, transcribe the whole phrase as it is naturally spoken (weak forms).
- "pos": one of word class (noun, verb, adjective, adverb...) or phrase, phrasal verb, idiom, collocation, question, sentence.
- "meaningVi": the meaning in natural Vietnamese (short, 1 line).
- "definitionEn": one short, simple English definition.
- "examples": exactly 2 or 3 examples. Each "en" is something a friendly British person would really SAY out loud, 6-14 words, containing the item; each "vi" is a natural Vietnamese translation.
- "tip": a pronunciation tip in Vietnamese for Vietnamese speakers (1-2 sentences): final consonants, linking, weak forms, stress, /θ ð ʃ ʒ/, long vs short vowels, non-rhotic "r" - only what matters for this item.`;

const ITEM_PROPS = {
  text: { type: 'string' },
  ipa: { type: 'string' },
  pos: { type: 'string' },
  meaningVi: { type: 'string' },
  definitionEn: { type: 'string' },
  examples: {
    type: 'array',
    items: {
      type: 'object',
      properties: { en: { type: 'string' }, vi: { type: 'string' } },
      required: ['en', 'vi'],
    },
  },
  tip: { type: 'string' },
};

const ITEMS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { type: 'object', properties: ITEM_PROPS, required: Object.keys(ITEM_PROPS) },
    },
  },
  required: ['items'],
};

export type EnrichedFields = Pick<Item, 'ipa' | 'pos' | 'meaningVi' | 'definitionEn' | 'examples' | 'tip'>;
export type GeneratedItem = EnrichedFields & { text: string };

const LEVEL_HINT: Record<Level, string> = {
  A2: 'A2 (elementary): very common, simple everyday phrases',
  B1: 'B1 (intermediate): common everyday phrases and collocations',
  B2: 'B2 (upper-intermediate): natural idiomatic phrases people use daily',
  C1: 'C1 (advanced): idiomatic, nuanced spoken expressions',
};

export function suggestTask(input: {
  topic: { name: string; description?: string };
  existing: string[];
  count: number;
  level: Level;
  hint?: string;
}) {
  const prompt = `Topic: "${input.topic.name}"${input.topic.description ? ` - ${input.topic.description}` : ''}
Learner level: ${LEVEL_HINT[input.level]}.
${input.hint ? `Learner's request: ${input.hint}\n` : ''}Already in this topic (do NOT repeat or near-duplicate these):
${input.existing.length ? input.existing.map((t) => `- ${t}`).join('\n') : '(none)'}

Suggest ${input.count} NEW words or phrases that are genuinely useful for SPEAKING about this topic in Britain.
Prefer chunks: phrases, collocations, short sentences and questions people actually say, over isolated rare words.
${STYLE_RULES}`;
  return { system: SYSTEM, prompt, schema: ITEMS_SCHEMA };
}

export function enrichTask(texts: string[], topic: { name: string }) {
  const prompt = `Topic: "${topic.name}".
Complete the learning card for each of these English words/phrases. Return them in the same order, with "text" copied exactly as given:
${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

${STYLE_RULES}`;
  return { system: SYSTEM, prompt, schema: ITEMS_SCHEMA };
}

function str(value: unknown, max = 600): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanExamples(value: unknown): Example[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((e) => ({ en: str((e as Example)?.en, 300), vi: str((e as Example)?.vi, 300) }))
    .filter((e) => e.en)
    .slice(0, 4);
}

function cleanIpa(ipa: string): string {
  const core = ipa.replace(/^[/[]+|[/\]]+$/g, '').trim();
  return core ? `/${core}/` : '';
}

export function normaliseItems(raw: unknown): GeneratedItem[] {
  const list = (raw as { items?: unknown })?.items;
  if (!Array.isArray(list)) return [];
  return list
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        text: str(o.text, 120),
        ipa: cleanIpa(str(o.ipa, 200)) || undefined,
        pos: str(o.pos, 40) || undefined,
        meaningVi: str(o.meaningVi, 300) || undefined,
        definitionEn: str(o.definitionEn, 300) || undefined,
        examples: cleanExamples(o.examples),
        tip: str(o.tip, 600) || undefined,
      };
    })
    .filter((item) => item.text);
}

/** Matches generated cards back to the requested texts: by text first, then by position. */
export function matchEnriched(
  texts: string[],
  generated: GeneratedItem[],
  key: (text: string) => string,
): Array<GeneratedItem | null> {
  const byKey = new Map(generated.map((g) => [key(g.text), g]));
  const matched = texts.map((text) => byKey.get(key(text)) ?? null);
  // Position fallback only among cards no other text has claimed.
  const used = new Set(matched.filter(Boolean));
  return matched.map((m, index) => {
    if (m) return m;
    const atIndex = generated[index];
    const candidate = atIndex && !used.has(atIndex) ? atIndex : generated.find((g) => !used.has(g));
    if (!candidate) return null;
    used.add(candidate);
    return candidate;
  });
}

// ---------- pronunciation coaching ----------

const TIP_SCHEMA = {
  type: 'object',
  properties: { word: { type: 'string' }, ipa: { type: 'string' }, tipVi: { type: 'string' } },
  required: ['word', 'ipa', 'tipVi'],
};

export function coachTask(input: { target: string; heard: string; words: WordResult[] }) {
  const missed = input.words.filter((w) => w.status !== 'ok');
  const prompt = `The learner tried to say: "${input.target}"
A speech recogniser heard: "${input.heard || '(nothing clear)'}"
Words the recogniser did not catch as intended: ${
    missed.length
      ? missed.map((w) => (w.heard ? `"${w.text}" (heard "${w.heard}")` : `"${w.text}" (missed)`)).join(', ')
      : 'none'
  }

Coach the learner in Vietnamese, warmly: first one short line of praise for what went well, then for each problem word explain how to produce it in British English (IPA, tongue/lip position, stress, linking with neighbouring words, final consonants). Explain likely causes only - the recogniser result is not a precise measurement, never invent scores.
"summaryVi": 1-3 friendly sentences in Vietnamese.
"tips": one entry per problem word (max 5), "ipa" British IPA, "tipVi" practical Vietnamese advice.
"drill": one short English practice line (a minimal pair, a tongue twister or the sentence chunked with linking marks like "getting‿on") the learner can repeat.`;
  return {
    system: SYSTEM,
    prompt,
    schema: {
      type: 'object',
      properties: { summaryVi: { type: 'string' }, tips: { type: 'array', items: TIP_SCHEMA }, drill: { type: 'string' } },
      required: ['summaryVi', 'tips', 'drill'],
    },
  };
}

function cleanTips(value: unknown): CoachTip[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      return { word: str(o.word, 80), ipa: cleanIpa(str(o.ipa, 120)), tipVi: str(o.tipVi, 500) };
    })
    .filter((t) => t.word && t.tipVi)
    .slice(0, 6);
}

export function normaliseCoach(raw: unknown): CoachReply {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { summaryVi: str(o.summaryVi, 800), tips: cleanTips(o.tips), drill: str(o.drill, 300) };
}

// ---------- conversation ----------

export function talkTask(input: {
  scenario: string;
  phrases: string[];
  history: TalkTurn[];
  level: Level;
}) {
  const last = input.history.at(-1);
  const opening = !last || last.role !== 'learner';
  const transcript = input.history
    .map((t) => `${t.role === 'tutor' ? 'Tutor' : 'Learner'}: ${t.text}`)
    .join('\n');
  const prompt = `You are role-playing a spoken conversation to help the learner practise speaking.
Scenario: ${input.scenario}
Learner level: ${LEVEL_HINT[input.level]}.
${input.phrases.length ? `Target phrases the learner is studying - steer the chat so they get a natural chance to use some of them (do not list them):\n${input.phrases.map((p) => `- ${p}`).join('\n')}\n` : ''}
Conversation so far:
${transcript || '(nothing yet)'}

${
    opening
      ? 'Start the conversation: greet the learner in character and ask one easy, open question. Leave "feedback" with empty lists and an empty praiseVi.'
      : `The learner's last turn came from a speech recogniser, so odd or wrong words may be mis-heard pronunciation rather than grammar mistakes.
Reply in character, naturally and warmly, in 1-3 short spoken sentences (max ~40 words), and end with a question or prompt that keeps them talking.
Then give feedback on the learner's LAST turn only:
- "praiseVi": one short, specific Vietnamese compliment.
- "corrections": only real problems (grammar, unnatural wording, non-British usage). "said" = their words, "better" = a natural British way to say it, "noteVi" = short Vietnamese explanation. Only offer British alternatives (never American ones such as "to go", "check", "apartment"). Empty list if it was fine.
- "pronunciation": words that were probably mis-pronounced (they look like recogniser mistakes), with British IPA and Vietnamese advice. Empty list if none.`
  }
"reply": what you say (English, British). "replyVi": its Vietnamese translation.`;
  return {
    system: SYSTEM,
    prompt,
    schema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        replyVi: { type: 'string' },
        feedback: {
          type: 'object',
          properties: {
            praiseVi: { type: 'string' },
            corrections: {
              type: 'array',
              items: {
                type: 'object',
                properties: { said: { type: 'string' }, better: { type: 'string' }, noteVi: { type: 'string' } },
                required: ['said', 'better', 'noteVi'],
              },
            },
            pronunciation: { type: 'array', items: TIP_SCHEMA },
          },
          required: ['praiseVi', 'corrections', 'pronunciation'],
        },
      },
      required: ['reply', 'replyVi', 'feedback'],
    },
  };
}

export function normaliseTalk(raw: unknown): TalkReply {
  const o = (raw ?? {}) as Record<string, unknown>;
  const f = (o.feedback ?? {}) as Record<string, unknown>;
  const corrections: TalkCorrection[] = Array.isArray(f.corrections)
    ? f.corrections
        .map((c) => {
          const r = (c ?? {}) as Record<string, unknown>;
          return { said: str(r.said, 300), better: str(r.better, 300), noteVi: str(r.noteVi, 500) };
        })
        .filter((c) => c.better && c.better.toLowerCase() !== c.said.toLowerCase())
        .slice(0, 4)
    : [];
  return {
    reply: str(o.reply, 800),
    replyVi: str(o.replyVi, 800),
    feedback: { praiseVi: str(f.praiseVi, 400), corrections, pronunciation: cleanTips(f.pronunciation) },
  };
}

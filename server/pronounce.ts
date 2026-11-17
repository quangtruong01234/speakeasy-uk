// Word-level comparison between a target sentence and what the recogniser heard.
// Pure functions: no I/O, covered by tests/pronounce.test.ts.

import type { PronounceResult, Rating, WordResult } from '../shared/types';

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "can't": 'can not',
  cannot: 'can not',
  "won't": 'will not',
  "shan't": 'shall not',
  "let's": 'let us',
  "y'all": 'you all',
  gonna: 'going to',
  wanna: 'want to',
  gotta: 'got to',
};

// Recognisers tend to spell the American way and pick a homophone by context.
// Neither is a pronunciation error, so both sides are mapped to one canonical form.
const SAME_WORD: Record<string, string> = {
  // UK → US spellings that the suffix rules below do not cover
  grey: 'gray', programme: 'program', cheque: 'check', tyre: 'tire', cosy: 'cozy',
  pyjamas: 'pajamas', kerb: 'curb', plough: 'plow', sceptical: 'skeptical',
  licence: 'license', practise: 'practice', defence: 'defense', offence: 'offense',
  ageing: 'aging', catalogue: 'catalog', dialogue: 'dialog', jewellery: 'jewelry',
  travelling: 'traveling', travelled: 'traveled', traveller: 'traveler',
  cancelled: 'canceled', cancelling: 'canceling', modelling: 'modeling',
  labelled: 'labeled', marvellous: 'marvelous', mum: 'mom', okay: 'ok',
  whilst: 'while', storey: 'story', draught: 'draft', enquiry: 'inquiry',
  // homophones
  too: 'to', two: 'to', four: 'for', their: 'there', buy: 'by', bye: 'by',
  know: 'no', write: 'right', hear: 'here', sea: 'see', weather: 'whether',
  weight: 'wait', weak: 'week', wood: 'would', knew: 'new', won: 'one',
  brake: 'break', peace: 'piece', meat: 'meet', male: 'mail', son: 'sun',
  flour: 'flower', hole: 'whole', witch: 'which', plain: 'plane', wear: 'where',
  // digits
  '0': 'zero', '1': 'one', '2': 'to', '3': 'three', '4': 'for', '5': 'five',
  '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
  '11': 'eleven', '12': 'twelve',
};

function canonical(word: string): string {
  let w = SAME_WORD[word] ?? word;
  if (w.length >= 5) w = w.replace(/our/g, 'or'); // colour, favourite, neighbour
  w = w.replace(/is(e|ed|es|ing|ation|ations|er|ers)$/, 'iz$1'); // realise, organised
  w = w.replace(/ys(e|ed|es|ing)$/, 'yz$1'); // analyse
  w = w.replace(/tre(s?)$/, 'ter$1'); // centre, theatres
  return SAME_WORD[w] ?? w;
}

/** Lower-case, expand contractions, strip punctuation; returns comparable tokens. */
export function tokens(text: string): string[] {
  const out: string[] = [];
  const cleaned = text
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ');
  for (let raw of cleaned.split(/\s+/)) {
    raw = raw.replace(/^'+|'+$/g, '');
    if (!raw) continue;
    let expanded = CONTRACTIONS[raw];
    if (!expanded) {
      expanded = raw
        .replace(/n't$/, ' not')
        .replace(/'re$/, ' are')
        .replace(/'ve$/, ' have')
        .replace(/'ll$/, ' will')
        .replace(/'m$/, ' am')
        // 's and 'd are ambiguous (is/has/possessive, would/had); keep them attached
        // to the stem so "it's" and "its" compare equal.
        .replace(/'(s|d)$/, '$1');
    }
    for (const part of expanded.split(' ')) {
      const t = part.replace(/'/g, '');
      if (t) out.push(canonical(t));
    }
  }
  return out;
}

type Op = { type: 'ok' | 'sub' | 'miss' | 'extra'; t?: number; h?: number };

/** 0..1 letter-level similarity (1 − normalised Levenshtein distance). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(up + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length, 1);
}

/**
 * Substituting a similar-sounding word is cheaper, so "going" pairs with "getting", not "on".
 * Unrelated words cost more than 1, so two unrelated swaps (2.4) lose to one miss + one extra (2).
 */
function subCost(a: string, b: string): number {
  return a === b ? 0 : 1.2 - 0.6 * similarity(a, b);
}

const EPS = 1e-9;

/** Edit-distance alignment over words. */
function align(target: string[], heard: string[]): Op[] {
  const n = target.length;
  const m = heard.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = subCost(target[i - 1], heard[j - 1]);
      d[i][j] = Math.min(d[i - 1][j - 1] + cost, d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && target[i - 1] === heard[j - 1] && Math.abs(d[i][j] - d[i - 1][j - 1]) < EPS) {
      ops.push({ type: 'ok', t: --i, h: --j });
    } else if (
      i > 0 &&
      j > 0 &&
      Math.abs(d[i][j] - (d[i - 1][j - 1] + subCost(target[i - 1], heard[j - 1]))) < EPS
    ) {
      ops.push({ type: 'sub', t: --i, h: --j });
    } else if (i > 0 && Math.abs(d[i][j] - (d[i - 1][j] + 1)) < EPS) {
      ops.push({ type: 'miss', t: --i });
    } else {
      ops.push({ type: 'extra', h: --j });
    }
  }
  return ops.reverse();
}

export function suggestRating(score: number): Rating {
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

export function compare(target: string, heard: string): PronounceResult {
  // Keep the learner-facing words, but compare their normalised tokens.
  const display = target.split(/\s+/).filter((w) => tokens(w).length > 0);
  const owner: number[] = [];
  const targetTokens: string[] = [];
  display.forEach((word, index) => {
    for (const t of tokens(word)) {
      targetTokens.push(t);
      owner.push(index);
    }
  });
  const heardTokens = tokens(heard);
  const ops = align(targetTokens, heardTokens);

  const words: WordResult[] = display.map((text) => ({ text, status: 'ok' }));
  const subs: string[][] = display.map(() => []);
  const extra: string[] = [];
  let okCount = 0;
  for (const op of ops) {
    if (op.type === 'ok') okCount++;
    else if (op.type === 'extra') extra.push(heardTokens[op.h!]);
    else {
      const w = owner[op.t!];
      if (op.type === 'sub') {
        subs[w].push(heardTokens[op.h!]);
        if (words[w].status === 'ok') words[w].status = 'sub';
      } else {
        words[w].status = words[w].status === 'sub' ? 'sub' : 'miss';
      }
    }
  }
  words.forEach((w, index) => {
    if (w.status === 'sub' && subs[index].length) w.heard = subs[index].join(' ');
    if (w.status === 'sub' && !subs[index].length) w.status = 'miss';
  });

  const score = targetTokens.length ? Math.round((100 * okCount) / targetTokens.length) : 0;
  return { score, heard: heard.trim(), words, extra, suggested: suggestRating(score) };
}

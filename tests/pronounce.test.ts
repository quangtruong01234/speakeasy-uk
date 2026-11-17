import { describe, expect, it } from 'vitest';
import { compare, similarity, suggestRating, tokens } from '../server/pronounce';

describe('tokens', () => {
  it('lower-cases, strips punctuation and expands contractions', () => {
    expect(tokens("I can't complain!")).toEqual(['i', 'can', 'not', 'complain']);
    expect(tokens("You're right, we'll see.")).toEqual(['you', 'are', 'right', 'we', 'will', 'see']);
  });

  it('treats curly apostrophes like straight ones', () => {
    expect(tokens('I’m fine')).toEqual(tokens("I'm fine"));
  });

  it('maps British and American spellings to one form', () => {
    expect(tokens('colour favourite centre realise grey')).toEqual(tokens('color favorite center realize gray'));
  });

  it('maps homophones and digits so recogniser choices are not errors', () => {
    expect(tokens('two')).toEqual(tokens('to'));
    expect(tokens('4')).toEqual(tokens('for'));
  });
});

describe('similarity', () => {
  it('is 1 for equal words and lower for different ones', () => {
    expect(similarity('cat', 'cat')).toBe(1);
    expect(similarity('getting', 'going')).toBeGreaterThan(similarity('on', 'going'));
    expect(similarity('abc', 'xyz')).toBe(0);
  });
});

describe('compare', () => {
  it('scores a perfect match 100 and suggests Good', () => {
    const r = compare('How are you getting on?', 'how are you getting on');
    expect(r.score).toBe(100);
    expect(r.words.every((w) => w.status === 'ok')).toBe(true);
    expect(r.suggested).toBe(3);
  });

  it('keeps the learner-facing words with their punctuation', () => {
    const r = compare('Fancy a cuppa?', 'fancy a cuppa');
    expect(r.words.map((w) => w.text)).toEqual(['Fancy', 'a', 'cuppa?']);
  });

  it('pairs a mis-heard word with the most similar target word', () => {
    const r = compare('How are you getting on?', 'How are you going?');
    expect(r.words[3]).toMatchObject({ text: 'getting', status: 'sub', heard: 'going' });
    expect(r.words[4]).toMatchObject({ text: 'on?', status: 'miss' });
    expect(r.score).toBe(60);
  });

  it('marks missing words and reports extra ones', () => {
    const r = compare('I must dash', 'I really must');
    expect(r.words.map((w) => w.status)).toEqual(['ok', 'ok', 'miss']);
    expect(r.extra).toEqual(['really']);
  });

  it('counts a contraction as one display word', () => {
    const r = compare("I can't complain", 'I cannot complain');
    expect(r.words).toHaveLength(3);
    expect(r.score).toBe(100);
  });

  it('gives 0 when nothing was heard', () => {
    const r = compare('Lovely to see you', '');
    expect(r.score).toBe(0);
    expect(r.words.every((w) => w.status === 'miss')).toBe(true);
    expect(r.suggested).toBe(1);
  });
});

describe('suggestRating', () => {
  it('maps score bands to ratings', () => {
    expect(suggestRating(95)).toBe(3);
    expect(suggestRating(75)).toBe(2);
    expect(suggestRating(40)).toBe(1);
  });
});

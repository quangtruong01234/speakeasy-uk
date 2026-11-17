import { describe, expect, it } from 'vitest';
import { itemKey } from '../server/store';
import {
  coachTask,
  matchEnriched,
  normaliseCoach,
  normaliseItems,
  normaliseTalk,
  talkTask,
} from '../server/prompts';

describe('normaliseItems', () => {
  it('cleans IPA slashes, trims fields and drops empty items', () => {
    const items = normaliseItems({
      items: [
        { text: '  Fancy a cuppa? ', ipa: '[ˈfænsi ə ˈkʌpə]', meaningVi: 'Làm tách trà không?', examples: [{ en: 'Fancy a cuppa?', vi: 'Uống trà nhé?' }, { en: '', vi: 'x' }] },
        { text: '' },
        null,
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Fancy a cuppa?');
    expect(items[0].ipa).toBe('/ˈfænsi ə ˈkʌpə/');
    expect(items[0].examples).toEqual([{ en: 'Fancy a cuppa?', vi: 'Uống trà nhé?' }]);
  });

  it('returns nothing for malformed replies', () => {
    expect(normaliseItems(null)).toEqual([]);
    expect(normaliseItems({ items: 'nope' })).toEqual([]);
  });
});

describe('matchEnriched', () => {
  it('matches by text first, then by position', () => {
    const gen = [
      { text: 'i must dash', examples: [] },
      { text: 'Something else', examples: [] },
    ];
    const out = matchEnriched(['Lovely to see you', 'I must dash'], gen, itemKey);
    expect(out[1]?.text).toBe('i must dash');
    expect(out[0]?.text).toBe('Something else');
  });
});

describe('coach', () => {
  it('lists the words the recogniser missed in the prompt', () => {
    const task = coachTask({
      target: 'How are you getting on?',
      heard: 'How are you going',
      words: [
        { text: 'getting', status: 'sub', heard: 'going' },
        { text: 'on?', status: 'miss' },
      ],
    });
    expect(task.prompt).toContain('"getting" (heard "going")');
    expect(task.prompt).toContain('"on?" (missed)');
  });

  it('drops tips without a word or advice', () => {
    const reply = normaliseCoach({ summaryVi: 'Tốt lắm', tips: [{ word: 'on', ipa: 'ɒn', tipVi: 'Mở miệng tròn' }, { word: '', tipVi: 'x' }], drill: 'getting‿on' });
    expect(reply.tips).toEqual([{ word: 'on', ipa: '/ɒn/', tipVi: 'Mở miệng tròn' }]);
  });
});

describe('talk', () => {
  it('asks for an opening line when the learner has not spoken yet', () => {
    const task = talkTask({ scenario: 'At a café', phrases: [], history: [], level: 'B1' });
    expect(task.prompt).toContain('Start the conversation');
  });

  it('asks for feedback on the learner’s last turn and lists target phrases', () => {
    const task = talkTask({
      scenario: 'At a café',
      phrases: ['Fancy a cuppa?'],
      history: [
        { role: 'tutor', text: 'Hello!' },
        { role: 'learner', text: 'I want a tea' },
      ],
      level: 'B1',
    });
    expect(task.prompt).toContain('Learner: I want a tea');
    expect(task.prompt).toContain('- Fancy a cuppa?');
    expect(task.prompt).not.toContain('Start the conversation');
  });

  it('drops corrections that change nothing', () => {
    const reply = normaliseTalk({
      reply: 'Lovely!',
      replyVi: 'Tuyệt!',
      feedback: {
        praiseVi: 'Hay',
        corrections: [
          { said: 'I want a tea', better: "I'd like a tea, please", noteVi: 'Lịch sự hơn' },
          { said: 'Thanks', better: 'thanks', noteVi: '' },
        ],
        pronunciation: [],
      },
    });
    expect(reply.feedback.corrections).toHaveLength(1);
  });
});

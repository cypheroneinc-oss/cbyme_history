import { describe, expect, it } from 'vitest';
import { diagnose, ValidationError } from '../../src/services/diagnose.js';
import { questions } from '../../src/data/questions.js';
import { AnswerInput } from '../../src/types/diagnostic.js';

function buildAnswers(map: Record<string, string | string[]>): AnswerInput[] {
  return questions.map((question) => {
    const selection = map[question.id];
    if (!selection) {
      throw new Error(`Missing selection for ${question.id}`);
    }

    if (question.type === 'single') {
      const option = Array.isArray(selection) ? selection[0] : selection;
      return { questionId: question.id, optionKey: option };
    }

    const optionKeys = Array.isArray(selection) ? selection : [selection];
    return { questionId: question.id, optionKeys };
  });
}

describe('diagnose', () => {
  it('identifies a challenge-speed type for action-oriented answers', () => {
    const answers = buildAnswers({
      Q01: 'A',
      Q02: 'A',
      Q03: 'A',
      Q04: 'B',
      Q05: 'A',
      Q06: 'A',
      Q07: 'B',
      Q08: 'A',
      Q09: 'A',
      Q10: 'B',
      Q11: 'A',
      Q12: 'A',
      Q13: 'B',
      Q14: 'A',
      Q15: ['Achiever', 'Autonomy', 'Growth'],
      Q16: 'D',
      Q17: ['silent_alone'],
      Q18: 'A',
      Q19: 'B',
      Q20: 'A',
      Q21: 'A',
      Q22: 'A',
      Q23: 'B',
      Q24: 'A',
      Q25: 'A',
    });

    const result = diagnose(answers);

    expect(result.typeId).toBe('challenge-speed');
    expect(result.scores.categories.challenge).toBeGreaterThan(result.scores.categories.create);
    const sentences = result.message
      .split('。')
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences.length).toBeLessThanOrEqual(6);
  });

  it('identifies a support-connect type for共感重視の回答', () => {
    const answers = buildAnswers({
      Q01: 'A',
      Q02: 'A',
      Q03: 'A',
      Q04: 'B',
      Q05: 'A',
      Q06: 'A',
      Q07: 'A',
      Q08: 'B',
      Q09: 'B',
      Q10: 'B',
      Q11: 'A',
      Q12: 'A',
      Q13: 'A',
      Q14: 'B',
      Q15: ['Contribution', 'Connection', 'Security'],
      Q16: 'B',
      Q17: ['pressure'],
      Q18: 'B',
      Q19: 'B',
      Q20: 'B',
      Q21: 'B',
      Q22: 'A',
      Q23: 'A',
      Q24: 'B',
      Q25: 'A',
    });

    const result = diagnose(answers);

    expect(result.typeId).toBe('support-connect');
    expect(result.scores.vectors.connect).toBeGreaterThan(result.scores.vectors.speed);
  });

  it('throws when a question is missing', () => {
    const answers = buildAnswers({
      Q01: 'A',
      Q02: 'A',
      Q03: 'A',
      Q04: 'B',
      Q05: 'A',
      Q06: 'A',
      Q07: 'B',
      Q08: 'A',
      Q09: 'A',
      Q10: 'B',
      Q11: 'A',
      Q12: 'A',
      Q13: 'B',
      Q14: 'A',
      Q15: ['Achiever', 'Autonomy', 'Growth'],
      Q16: 'D',
      Q17: ['silent_alone'],
      Q18: 'A',
      Q19: 'B',
      Q20: 'A',
      Q21: 'A',
      Q22: 'A',
      Q23: 'B',
      Q24: 'A',
      Q25: 'A',
    });

    answers.pop();

    expect(() => diagnose(answers)).toThrow(ValidationError);
  });
});

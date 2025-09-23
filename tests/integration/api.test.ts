import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
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

describe('POST /api/diagnose', () => {
  it('returns a diagnosis for valid answers', async () => {
    const app = createApp();
    const payload = {
      answers: buildAnswers({
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
      }),
    };

    const response = await request(app).post('/api/diagnose').send(payload);

    expect(response.status).toBe(200);
    expect(response.body.typeId).toBe('challenge-speed');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThan(0);
    expect(response.body.scores).toBeDefined();
    expect(response.body.scores.categories.challenge).toBeGreaterThan(0);
  });

  it('returns 400 for invalid payload', async () => {
    const app = createApp();
    const response = await request(app).post('/api/diagnose').send({ answers: [{ foo: 'bar' }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});

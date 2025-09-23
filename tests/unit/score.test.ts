import { describe, expect, it } from 'vitest';
import {
  aggregateRawScores,
  computeMaxScores,
  computeProfileScore,
  ensureAllQuestionsAnswered,
  normaliseScores,
  resolveSelectedKeys,
  separatePenalties,
} from '../../src/lib/score.js';
import { ValidationError } from '../../src/lib/errors.js';
import { CategoryProfile, Question } from '../../src/types/diagnostic.js';

describe('score helpers', () => {
  const singleQuestion: Question = {
    id: 'S1',
    prompt: 'single',
    type: 'single',
    options: [
      { key: 'A', label: 'low', scores: { foo: 1 } },
      { key: 'B', label: 'high', scores: { foo: 2 } },
    ],
  };

  const multiQuestion: Question = {
    id: 'M1',
    prompt: 'multi',
    type: 'multi',
    maxSelect: 2,
    options: [
      { key: 'X', label: 'first', scores: { bar: 1 } },
      { key: 'Y', label: 'second', scores: { bar: 3 } },
      { key: 'Z', label: 'third', scores: { bar: 2 } },
    ],
  };

  it('computes maximum attainable scores across question types', () => {
    const totals = computeMaxScores([singleQuestion, multiQuestion]);
    expect(totals.foo).toBe(2);
    expect(totals.bar).toBe(5);
  });

  it('normalises using provided maxima and guards zero division', () => {
    const raw = { foo: 3, zero: 10 };
    const normalised = normaliseScores(raw, {
      maxScores: { foo: 6, zero: 0 },
      dimensions: ['foo', 'zero'],
    });
    expect(normalised.foo).toBeCloseTo(0.5);
    expect(normalised.zero).toBe(0);
  });

  it('resolves selections for single and multi choice questions', () => {
    expect(resolveSelectedKeys({ questionId: 'S1', optionKey: 'B' }, singleQuestion)).toEqual(['B']);

    const multiResult = resolveSelectedKeys(
      { questionId: 'M1', optionKeys: ['Z', 'Y', 'Y'] },
      multiQuestion,
    );
    expect(multiResult).toEqual(['Z', 'Y']);

    expect(() =>
      resolveSelectedKeys({ questionId: 'M1', optionKeys: ['X', 'Y', 'Z'] }, multiQuestion),
    ).toThrow(ValidationError);
  });

  it('aggregates raw scores and validates options', () => {
    const questionLookup = new Map<string, Question>([
      [singleQuestion.id, singleQuestion],
      [multiQuestion.id, multiQuestion],
    ]);

    const totals = aggregateRawScores(
      [
        { questionId: 'S1', optionKey: 'B' },
        { questionId: 'M1', optionKeys: ['Y', 'Z'] },
      ],
      questionLookup,
    );
    expect(totals).toEqual({ foo: 2, bar: 5 });

    expect(() => aggregateRawScores([{ questionId: 'X', optionKey: 'A' }], questionLookup)).toThrow(
      ValidationError,
    );
  });

  it('ensures all questions are answered exactly once', () => {
    expect(() =>
      ensureAllQuestionsAnswered([
        { questionId: 'S1', optionKey: 'A' },
        { questionId: 'M1', optionKeys: ['X'] },
      ], [singleQuestion, multiQuestion]),
    ).not.toThrow();

    expect(() =>
      ensureAllQuestionsAnswered([{ questionId: 'S1', optionKey: 'A' }], [singleQuestion, multiQuestion]),
    ).toThrow(ValidationError);

    expect(() =>
      ensureAllQuestionsAnswered(
        [
          { questionId: 'S1', optionKey: 'A' },
          { questionId: 'S1', optionKey: 'B' },
          { questionId: 'M1', optionKeys: ['X'] },
        ],
        [singleQuestion, multiQuestion],
      ),
    ).toThrow(ValidationError);
  });

  it('separates penalties and computes profile scores with deductions', () => {
    const { positive, penalties } = separatePenalties({ foo: 0.8, 'ng.bar': 0.5 });
    expect(positive).toEqual({ foo: 0.8 });
    expect(penalties).toEqual({ 'ng.bar': 0.5 });

    const profile: CategoryProfile = {
      key: 'challenge',
      label: 'Demo',
      strength: '',
      utilization: '',
      cautionFallback: '',
      weights: { foo: 0.5 },
      penalties: { 'ng.bar': 0.4 },
    };

    const score = computeProfileScore(profile, positive, penalties);
    expect(score).toBeCloseTo(Math.max(0, 0.8 * 0.5 - 0.5 * 0.4));
  });
});

import { questionMap, questions } from '../data/questions.js';
import {
  AnswerInput,
  CategoryProfile,
  Question,
  VectorProfile,
} from '../types/diagnostic.js';
import { ValidationError } from './errors.js';

export type ScoreRecord = Record<string, number>;

export function computeMaxScores(allQuestions: Question[]): ScoreRecord {
  const totals: ScoreRecord = {};

  for (const question of allQuestions) {
    if (question.type === 'single') {
      const dimensionMax: ScoreRecord = {};
      for (const option of question.options) {
        for (const [dimension, value] of Object.entries(option.scores)) {
          if (value <= 0) continue;
          dimensionMax[dimension] = Math.max(dimensionMax[dimension] ?? 0, value);
        }
      }
      for (const [dimension, value] of Object.entries(dimensionMax)) {
        totals[dimension] = (totals[dimension] ?? 0) + value;
      }
      continue;
    }

    const contributions: Record<string, number[]> = {};
    const maxSelect = question.maxSelect ?? question.options.length;
    for (const option of question.options) {
      for (const [dimension, value] of Object.entries(option.scores)) {
        if (value <= 0) continue;
        if (!contributions[dimension]) {
          contributions[dimension] = [];
        }
        contributions[dimension]!.push(value);
      }
    }
    for (const [dimension, values] of Object.entries(contributions)) {
      const sorted = values.slice().sort((a, b) => b - a);
      const limit = Math.min(maxSelect, sorted.length);
      const sum = sorted.slice(0, limit).reduce((acc, value) => acc + value, 0);
      totals[dimension] = (totals[dimension] ?? 0) + sum;
    }
  }

  return totals;
}

export const maxScores = computeMaxScores(questions);

export function normaliseScores(
  raw: ScoreRecord,
  options: { maxScores?: ScoreRecord; dimensions?: string[] } = {},
): ScoreRecord {
  const maxLookup = options.maxScores ?? maxScores;
  const dimensions = options.dimensions ?? Object.keys(maxLookup);
  const normalised: ScoreRecord = {};

  for (const dimension of dimensions) {
    const max = maxLookup[dimension] ?? 0;
    const rawValue = raw[dimension] ?? 0;
    if (max <= 0) {
      normalised[dimension] = 0;
      continue;
    }
    const value = Math.min(rawValue / max, 1);
    normalised[dimension] = Number.isFinite(value) ? value : 0;
  }

  return normalised;
}

export function resolveSelectedKeys(answer: AnswerInput, question: Question): string[] {
  if (question.type === 'single') {
    if ('optionKey' in answer && typeof answer.optionKey === 'string') {
      return [answer.optionKey];
    }
    if ('optionKeys' in answer) {
      if (!Array.isArray(answer.optionKeys)) {
        throw new ValidationError(`optionKeys must be an array for question ${question.id}`);
      }
      if (answer.optionKeys.length !== 1) {
        throw new ValidationError(`Single choice question ${question.id} expects exactly one option`);
      }
      return [answer.optionKeys[0]];
    }
    throw new ValidationError(`Missing optionKey for question ${question.id}`);
  }

  if (!('optionKeys' in answer) || !Array.isArray(answer.optionKeys)) {
    throw new ValidationError(`Missing optionKeys for question ${question.id}`);
  }
  const maxSelect = question.maxSelect ?? question.options.length;
  const uniqueKeys = Array.from(new Set(answer.optionKeys));
  if (uniqueKeys.length > maxSelect) {
    throw new ValidationError(`Question ${question.id} allows up to ${maxSelect} selections`);
  }
  if (uniqueKeys.length === 0) {
    return [];
  }
  return uniqueKeys;
}

export function aggregateRawScores(
  answers: AnswerInput[],
  questionLookup: Map<string, Question> = questionMap,
): ScoreRecord {
  const totals: ScoreRecord = {};
  for (const answer of answers) {
    const question = questionLookup.get(answer.questionId);
    if (!question) {
      throw new ValidationError(`Unknown question id: ${answer.questionId}`);
    }

    const selectedKeys = resolveSelectedKeys(answer, question);
    if (selectedKeys.length === 0) {
      throw new ValidationError(`No options selected for question ${question.id}`);
    }

    for (const key of selectedKeys) {
      const option = question.options.find((opt) => opt.key === key);
      if (!option) {
        throw new ValidationError(`Invalid option ${key} for question ${question.id}`);
      }
      for (const [dimension, value] of Object.entries(option.scores)) {
        totals[dimension] = (totals[dimension] ?? 0) + value;
      }
    }
  }
  return totals;
}

export function ensureAllQuestionsAnswered(
  answers: AnswerInput[],
  allQuestions: Question[] = questions,
): void {
  const answerMap = new Map<string, AnswerInput>();
  for (const answer of answers) {
    if (answerMap.has(answer.questionId)) {
      throw new ValidationError(`Duplicate answer for question ${answer.questionId}`);
    }
    answerMap.set(answer.questionId, answer);
  }
  for (const question of allQuestions) {
    if (!answerMap.has(question.id)) {
      throw new ValidationError(`Missing answer for question ${question.id}`);
    }
  }
}

export function separatePenalties(normalised: ScoreRecord): {
  positive: ScoreRecord;
  penalties: ScoreRecord;
} {
  const positive: ScoreRecord = {};
  const penalties: ScoreRecord = {};
  for (const [dimension, value] of Object.entries(normalised)) {
    if (dimension.startsWith('ng.')) {
      penalties[dimension] = value;
    } else {
      positive[dimension] = value;
    }
  }
  return { positive, penalties };
}

export function computeProfileScore(
  profile: CategoryProfile | VectorProfile,
  normalised: ScoreRecord,
  penalties: ScoreRecord,
): number {
  let score = 0;
  for (const [dimension, weight] of Object.entries(profile.weights)) {
    score += (normalised[dimension] ?? 0) * weight;
  }
  if (profile.penalties) {
    let penaltyTotal = 0;
    for (const [dimension, weight] of Object.entries(profile.penalties)) {
      penaltyTotal += (penalties[dimension] ?? 0) * weight;
    }
    score -= penaltyTotal;
  }
  return Math.max(0, score);
}

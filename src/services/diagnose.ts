import { scoringConfig } from '../config/scoring.js';
import {
  aggregateRawScores,
  computeProfileScore,
  ensureAllQuestionsAnswered,
  maxScores,
  normaliseScores,
  separatePenalties,
  type ScoreRecord,
} from '../lib/score.js';
import { selectTopProfile } from '../lib/type-map.js';
import { ValidationError } from '../lib/errors.js';
import {
  AnswerInput,
  CategoryKey,
  CategoryProfile,
  DiagnoseResult,
  ScoreBreakdown,
  VectorKey,
  VectorProfile,
} from '../types/diagnostic.js';

function trimEndingPunctuation(text: string): string {
  return text.trim().replace(/[。.]$/u, '');
}

function buildMessage(
  category: CategoryProfile,
  vector: VectorProfile,
  penalties: ScoreRecord,
  normalised: ScoreRecord,
): string {
  const { penaltyMessages, motivationMessages } = scoringConfig.message;

  let topPenaltyKey: string | undefined;
  let topPenaltyScore = 0;
  for (const [dimension, value] of Object.entries(penalties)) {
    if (value > topPenaltyScore) {
      topPenaltyScore = value;
      topPenaltyKey = dimension;
    }
  }
  const cautionSource =
    topPenaltyKey && topPenaltyScore > 0
      ? penaltyMessages[topPenaltyKey] ?? category.cautionFallback
      : category.cautionFallback;
  const cautionSentence = trimEndingPunctuation(cautionSource);

  let topMotivationKey: string | undefined;
  let topMotivationScore = 0;
  for (const [dimension, value] of Object.entries(normalised)) {
    if (!dimension.startsWith('motivation.')) continue;
    if (value >= topMotivationScore) {
      topMotivationScore = value;
      topMotivationKey = dimension;
    }
  }
  const motivationSentenceBase = topMotivationKey
    ? motivationMessages[topMotivationKey] ?? '日々の行動を小さく記録し、気づきを次に活かしましょう'
    : '日々の行動を小さく記録し、気づきを次に活かしましょう';

  const strengthSentence = `あなたは${category.label}×${vector.label}タイプで、${category.strength}${vector.strengthSuffix}。`;
  const weaknessSentence = `一方で、${cautionSentence}。`;
  const categoryUtilization = trimEndingPunctuation(category.utilization);
  const vectorAddon = trimEndingPunctuation(vector.utilizationAddon);
  const utilisationSentence = `この強みを活かすには、${categoryUtilization}。`;
  const utilisationDetailSentence = `特に${vectorAddon}。`;
  const nextActionSentence = `次の一歩として、${motivationSentenceBase}。`;

  return [
    strengthSentence,
    weaknessSentence,
    utilisationSentence,
    utilisationDetailSentence,
    nextActionSentence,
  ].join(' ');
}

export function diagnose(answers: AnswerInput[]): DiagnoseResult {
  if (!Array.isArray(answers)) {
    throw new ValidationError('answers must be an array');
  }
  ensureAllQuestionsAnswered(answers);
  const rawScores = aggregateRawScores(answers);
  const normalisedAll = normaliseScores(rawScores);
  const { positive: positiveNormalised, penalties } = separatePenalties(normalisedAll);

  const categoryScores: Record<CategoryKey, number> = {
    challenge: 0,
    create: 0,
    support: 0,
    strategy: 0,
  };
  const vectorScores: Record<VectorKey, number> = {
    speed: 0,
    structure: 0,
    explore: 0,
    connect: 0,
  };

  for (const profile of scoringConfig.categories) {
    categoryScores[profile.key] = computeProfileScore(profile, positiveNormalised, penalties);
  }

  for (const profile of scoringConfig.vectors) {
    vectorScores[profile.key] = computeProfileScore(profile, positiveNormalised, penalties);
  }

  const topCategory = selectTopProfile(scoringConfig.categories, categoryScores, scoringConfig.tieBreakers.categories);
  const topVector = selectTopProfile(scoringConfig.vectors, vectorScores, scoringConfig.tieBreakers.vectors);

  const message = buildMessage(
    scoringConfig.categories.find((c) => c.key === topCategory.key)!,
    scoringConfig.vectors.find((v) => v.key === topVector.key)!,
    penalties,
    positiveNormalised,
  );

  const positiveDimensions = Object.fromEntries(
    Object.entries(positiveNormalised).map(([dimension, value]) => [dimension, value]),
  );

  const scores: ScoreBreakdown = {
    raw: rawScores,
    normalized: positiveDimensions,
    penalties,
    categories: categoryScores,
    vectors: vectorScores,
  };

  return {
    typeId: `${topCategory.key}-${topVector.key}`,
    category: topCategory.key as CategoryKey,
    vector: topVector.key as VectorKey,
    scores,
    message,
  };
}

export { maxScores, ValidationError };

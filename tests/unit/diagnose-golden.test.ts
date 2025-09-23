import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diagnose } from '../../src/services/diagnose.js';
import { AnswerInput, CategoryKey, VectorKey } from '../../src/types/diagnostic.js';

const FIXTURE_DIR = join('tests', 'fixtures');

type GoldenFixture = {
  name: string;
  expectedType: string;
  categories: Record<CategoryKey, number>;
  vectors: Record<VectorKey, number>;
};

const cases: GoldenFixture[] = [
  {
    name: 'challenge-speed',
    expectedType: 'challenge-speed',
    categories: { challenge: 0.9666666666666667, create: 0.43000000000000005, support: 0, strategy: 0.15000000000000002 },
    vectors: { speed: 0.9, structure: 0.1, explore: 0.33333333333333337, connect: 0 },
  },
  {
    name: 'support-connect',
    expectedType: 'support-connect',
    categories: {
      challenge: 0.24999999999999997,
      create: 0.41000000000000003,
      support: 0.7833333333333333,
      strategy: 1.3877787807814457e-17,
    },
    vectors: { speed: 0.5833333333333334, structure: 0.03333333333333334, explore: 0.2, connect: 0.9333333333333336 },
  },
  {
    name: 'create-explore',
    expectedType: 'create-explore',
    categories: { challenge: 0.51, create: 0.7300000000000002, support: 0.16999999999999998, strategy: 0 },
    vectors: { speed: 0.24999999999999994, structure: 0.2, explore: 0.6500000000000001, connect: 0.30000000000000004 },
  },
  {
    name: 'strategy-structure',
    expectedType: 'strategy-structure',
    categories: { challenge: 0, create: 0.13, support: 0, strategy: 0.6800000000000002 },
    vectors: { speed: 0, structure: 0.9333333333333333, explore: 0.18333333333333335, connect: 0.03333333333333334 },
  },
];

describe('diagnose golden fixtures', () => {
  for (const testCase of cases) {
    it(`produces stable output for ${testCase.name}`, () => {
      const raw = readFileSync(join(FIXTURE_DIR, `${testCase.name}.json`), 'utf-8');
      const fixture = JSON.parse(raw) as { typeId: string; answers: AnswerInput[] };
      const result = diagnose(fixture.answers);

      expect(result.typeId).toBe(testCase.expectedType);
      expect(result.typeId).toBe(fixture.typeId);
      expect(result.category).toBe(testCase.expectedType.split('-')[0]);
      expect(result.vector).toBe(testCase.expectedType.split('-')[1]);

      for (const [key, value] of Object.entries(testCase.categories)) {
        expect(result.scores.categories[key as CategoryKey]).toBeCloseTo(value, 10);
      }
      for (const [key, value] of Object.entries(testCase.vectors)) {
        expect(result.scores.vectors[key as VectorKey]).toBeCloseTo(value, 10);
      }

      const sentences = result.message
        .split('。')
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);
      expect(sentences.length).toBeGreaterThanOrEqual(3);
      expect(sentences.length).toBeLessThanOrEqual(6);
    });
  }
});

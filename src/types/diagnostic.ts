export type QuestionType = 'single' | 'multi';

export interface QuestionOption {
  key: string;
  label: string;
  scores: Record<string, number>;
}

export interface Question {
  id: string;
  prompt: string;
  type: QuestionType;
  maxSelect?: number;
  options: QuestionOption[];
}

export type AnswerInput =
  | {
      questionId: string;
      type?: 'single';
      optionKey: string;
    }
  | {
      questionId: string;
      type?: 'multi';
      optionKeys: string[];
    };

export type CategoryKey = 'challenge' | 'create' | 'support' | 'strategy';
export type VectorKey = 'speed' | 'structure' | 'explore' | 'connect';

export interface ScoreBreakdown {
  raw: Record<string, number>;
  normalized: Record<string, number>;
  penalties: Record<string, number>;
  categories: Record<CategoryKey, number>;
  vectors: Record<VectorKey, number>;
}

export interface DiagnoseResult {
  typeId: string;
  category: CategoryKey;
  vector: VectorKey;
  scores: ScoreBreakdown;
  message: string;
}

export interface WeightedDimensionMap {
  [dimension: string]: number;
}

export interface CategoryProfile {
  key: CategoryKey;
  label: string;
  strength: string;
  utilization: string;
  cautionFallback: string;
  weights: WeightedDimensionMap;
  penalties?: WeightedDimensionMap;
}

export interface VectorProfile {
  key: VectorKey;
  label: string;
  strengthSuffix: string;
  utilizationAddon: string;
  weights: WeightedDimensionMap;
  penalties?: WeightedDimensionMap;
}

export interface MessageConfig {
  penaltyMessages: Record<string, string>;
  motivationMessages: Record<string, string>;
}

export interface ScoringConfig {
  categories: CategoryProfile[];
  vectors: VectorProfile[];
  tieBreakers: {
    categories: CategoryKey[];
    vectors: VectorKey[];
  };
  message: MessageConfig;
}

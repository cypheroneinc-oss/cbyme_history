import { CategoryKey, VectorKey } from '../types/diagnostic.js';

type ProfileKey = CategoryKey | VectorKey;

type ProfileWithKey<K extends ProfileKey> = { key: K };

/**
 * Selects the profile with the highest score. When multiple profiles share the same score,
 * the ordering defined in {@link tieBreaker} determines which key wins. Keys that appear
 * earlier in the array outrank later ones, ensuring deterministic results even for ties.
 */
export function selectTopProfile<K extends ProfileKey, T extends ProfileWithKey<K>>(
  profiles: readonly T[],
  scores: Record<K, number>,
  tieBreaker: readonly K[],
): { key: K; score: number } {
  let topKey: K | null = null;
  let topScore = -Infinity;

  for (const profile of profiles) {
    const value = scores[profile.key] ?? -Infinity;
    if (value > topScore) {
      topScore = value;
      topKey = profile.key;
      continue;
    }
    if (value === topScore && topKey !== null) {
      const currentIndex = tieBreaker.indexOf(topKey);
      const candidateIndex = tieBreaker.indexOf(profile.key);
      if (candidateIndex !== -1 && (currentIndex === -1 || candidateIndex < currentIndex)) {
        topKey = profile.key;
      }
    }
  }

  if (topKey === null) {
    throw new Error('Unable to determine top profile');
  }

  return { key: topKey, score: topScore };
}

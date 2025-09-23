import { describe, expect, it } from 'vitest';
import { selectTopProfile } from '../../src/lib/type-map.js';

describe('selectTopProfile', () => {
  it('returns the profile with the highest score', () => {
    const profiles = [
      { key: 'challenge' },
      { key: 'create' },
      { key: 'support' },
    ] as const;
    const scores: Record<(typeof profiles)[number]['key'], number> = {
      challenge: 0.42,
      create: 0.73,
      support: 0.18,
    };
    const tieBreaker = ['challenge', 'create', 'support'] as const;

    const result = selectTopProfile(profiles, scores, tieBreaker);
    expect(result).toEqual({ key: 'create', score: 0.73 });
  });

  it('uses tie-breaker ordering to resolve equal scores', () => {
    const profiles = [
      { key: 'challenge' },
      { key: 'create' },
      { key: 'support' },
    ] as const;
    const scores: Record<(typeof profiles)[number]['key'], number> = {
      challenge: 0.6,
      create: 0.6,
      support: 0.6,
    };
    const tieBreaker = ['support', 'create', 'challenge'] as const;

    const result = selectTopProfile(profiles, scores, tieBreaker);
    expect(result.key).toBe('support');
  });

  it('ignores tie-breaker gaps and falls back to existing winner', () => {
    const profiles: Array<{ key: 'speed' | 'structure' | 'connect' }> = [
      { key: 'speed' },
      { key: 'structure' },
      { key: 'connect' },
    ];
    const scores: Record<'speed' | 'structure' | 'connect', number> = {
      speed: 0.4,
      structure: 0.4,
      connect: 0.2,
    };
    const tieBreaker: Array<'speed' | 'structure' | 'connect'> = ['structure'];

    const result = selectTopProfile(profiles, scores, tieBreaker);
    expect(result.key).toBe('structure');
  });

  it('throws when no profiles are provided', () => {
    expect(() => selectTopProfile([], {} as Record<string, number>, [])).toThrow('Unable to determine top profile');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildLineReply,
  buildResultUrl,
  buildTypeMessage,
  normaliseAlias,
  resolveTypeFromText,
} from '../../src/services/line-reply.js';

describe('normaliseAlias', () => {
  it('normalises whitespace and case for latin input', () => {
    expect(normaliseAlias(' Ryoma Sakamoto ')).toBe('ryomasakamoto');
  });

  it('converts katakana to hiragana', () => {
    expect(normaliseAlias('リョウマ')).toBe('りょうま');
  });

  it('strips common honorifics', () => {
    expect(normaliseAlias('坂本龍馬さん')).toBe('坂本龍馬');
  });
});

describe('resolveTypeFromText', () => {
  it('matches aliases regardless of script', () => {
    const resolution = resolveTypeFromText('ryoma');
    expect(resolution).not.toBeNull();
    expect(resolution?.canonicalName).toBe('坂本龍馬');
    expect(resolution?.typeId).toBe('challenge-connect');
  });

  it('falls back to null when alias is unknown', () => {
    expect(resolveTypeFromText('unknown hero')).toBeNull();
  });
});

describe('buildTypeMessage', () => {
  it('produces a five-sentence paragraph referencing the canonical name', () => {
    const message = buildTypeMessage('challenge-connect', '坂本龍馬');
    const sentences = message
      .split('。')
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
    expect(sentences).toHaveLength(5);
    expect(sentences[0]).toContain('坂本龍馬にちなんだタイプはチャレンジ×コネクトタイプ');
  });
});

describe('buildLineReply', () => {
  it('appends the result page URL with the resolved typeId', () => {
    const resolution = resolveTypeFromText('ナイチンゲール');
    expect(resolution).not.toBeNull();
    const reply = buildLineReply(resolution!, 'https://example.com/app/');
    expect(reply).toMatch(/https:\/\/example.com\/app\/result\?typeId=support-connect$/);
  });
});

describe('buildResultUrl', () => {
  it('normalises repeated trailing slashes', () => {
    const url = buildResultUrl('https://example.com/base///', 'support-connect');
    expect(url).toBe('https://example.com/base/result?typeId=support-connect');
  });
});

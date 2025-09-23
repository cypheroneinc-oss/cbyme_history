import { scoringConfig } from '../config/scoring.js';
import { aliasRecords } from '../data/name-aliases.js';
import { CategoryKey, VectorKey, CategoryProfile, VectorProfile } from '../types/diagnostic.js';
import { TypeIdString } from '../types/line.js';

export interface ResolvedType {
  canonicalName: string;
  typeId: TypeIdString;
}

const aliasIndex = buildAliasIndex();
const DEFAULT_NEXT_ACTION = '日々の行動を小さく記録し、気づきを次に活かしましょう';

function buildAliasIndex(): Map<string, ResolvedType> {
  const index = new Map<string, ResolvedType>();
  for (const record of aliasRecords) {
    for (const alias of record.aliases) {
      const key = normaliseAlias(alias);
      if (!key) continue;
      if (!index.has(key)) {
        index.set(key, { canonicalName: record.canonicalName, typeId: record.typeId });
      }
    }
  }
  return index;
}

function stripHonorifics(value: string): string {
  return value.replace(/(さん|様|さま|殿|どの|君|くん|ちゃん|氏)$/u, '');
}

export function normaliseAlias(value: string): string {
  const trimmed = stripHonorifics(value.trim());
  if (!trimmed) return '';
  const unified = trimmed.normalize('NFKC').toLowerCase();
  const hira = unified.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  return hira.replace(/[^\p{Letter}\p{Number}ー]/gu, '');
}

function trimEndingPunctuation(text: string): string {
  return text.trim().replace(/[。．.]+$/u, '');
}

function resolveProfiles(typeId: TypeIdString): { category: CategoryProfile; vector: VectorProfile } {
  const [categoryKeyRaw, vectorKeyRaw] = typeId.split('-');
  const categoryKey = categoryKeyRaw as CategoryKey;
  const vectorKey = vectorKeyRaw as VectorKey;
  const category = scoringConfig.categories.find((entry) => entry.key === categoryKey);
  const vector = scoringConfig.vectors.find((entry) => entry.key === vectorKey);
  if (!category || !vector) {
    throw new Error(`Unknown typeId: ${typeId}`);
  }
  return { category, vector };
}

export function buildTypeMessage(typeId: TypeIdString, referenceName?: string): string {
  const { category, vector } = resolveProfiles(typeId);
  const subject = referenceName ? `${referenceName}にちなんだタイプは` : 'あなたは';
  const strength = `${subject}${category.label}×${vector.label}タイプで、${trimEndingPunctuation(category.strength)}${trimEndingPunctuation(vector.strengthSuffix)}。`;
  const caution = `一方で、${trimEndingPunctuation(category.cautionFallback)}。`;
  const utilisation = `この強みを活かすには、${trimEndingPunctuation(category.utilization)}。`;
  const detail = `特に${trimEndingPunctuation(vector.utilizationAddon)}。`;
  const nextAction = `次の一歩として、${DEFAULT_NEXT_ACTION}。`;
  return [strength, caution, utilisation, detail, nextAction].filter(Boolean).join(' ');
}

export function resolveTypeFromText(input: string): ResolvedType | null {
  const key = normaliseAlias(input);
  if (!key) return null;
  return aliasIndex.get(key) ?? null;
}

export function buildResultUrl(baseUrl: string, typeId: TypeIdString): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/result?typeId=${encodeURIComponent(typeId)}`;
}

export function buildLineReply(resolution: ResolvedType, baseUrl: string): string {
  const summary = buildTypeMessage(resolution.typeId, resolution.canonicalName);
  const url = buildResultUrl(baseUrl, resolution.typeId);
  return `${summary} ${url}`.trim();
}

export function buildUnknownNameReply(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '偉人名が読み取れませんでした。もう一度テキストで偉人名を送ってください。';
  }
  return `${trimmed}に対応するタイプを見つけられませんでした。別の偉人名や表記で試してみてください。`;
}

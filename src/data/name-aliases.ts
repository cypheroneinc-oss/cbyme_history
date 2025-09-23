import nameAliasesJson from '../../data/name_aliases.json' with { type: 'json' };
import { NameAliasEntry, NameAliasMap } from '../types/line.js';

const rawAliases = nameAliasesJson as unknown as NameAliasMap;

export const nameAliases: NameAliasMap = rawAliases;

export interface AliasRecord extends NameAliasEntry {
  canonicalName: string;
}

export const aliasRecords: AliasRecord[] = Object.entries(nameAliases).map(([canonicalName, entry]) => ({
  canonicalName,
  typeId: entry.typeId,
  aliases: Array.from(new Set([canonicalName, ...(entry.aliases ?? [])])),
}));

import { CategoryKey, VectorKey } from './diagnostic.js';

export type TypeIdString = `${CategoryKey}-${VectorKey}`;

export interface NameAliasEntry {
  typeId: TypeIdString;
  aliases: string[];
}

export type NameAliasMap = Record<string, NameAliasEntry>;

export interface LineTextMessage {
  type: 'text';
  id?: string;
  text: string;
}

export interface LineMessageEvent {
  type: 'message';
  replyToken: string;
  message: LineTextMessage | { type: string };
}

export type LineEvent = LineMessageEvent | { type: string };

export interface LineWebhookRequestBody {
  destination?: string;
  events: LineEvent[];
}

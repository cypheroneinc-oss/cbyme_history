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

export interface LineEventSource {
  type?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface LinePostbackContent {
  data?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LineEvent {
  type: string;
  replyToken?: string;
  message?: LineTextMessage | { type: string; [key: string]: unknown };
  postback?: LinePostbackContent;
  source?: LineEventSource;
  [key: string]: unknown;
}

export interface LineMessageEvent extends LineEvent {
  type: 'message';
  replyToken: string;
  message: LineTextMessage | { type: string };
}

export interface LineWebhookRequestBody {
  destination?: string;
  events: LineEvent[];
}

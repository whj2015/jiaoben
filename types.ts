export interface UserScript {
  id: string;
  name: string;
  description: string;
  version: string;
  match: string[]; // @match 规则
  exclude: string[]; // @exclude 规则
  code: string;
  enabled: boolean;
  runAt: 'document-start' | 'document-end' | 'document-idle';
  updatedAt: number;
}

export enum ViewState {
  LIST = 'LIST',
  EDITOR = 'EDITOR',
  SETTINGS = 'SETTINGS'
}

export enum Language {
  EN = 'en',
  ZH_CN = 'zh-CN',
  JA = 'ja',
  ES = 'es'
}

export interface ScriptMetadata {
  name: string;
  namespace?: string;
  version?: string;
  description?: string;
  author?: string;
  match: string[];
  exclude: string[];
  runAt?: string;
}

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}
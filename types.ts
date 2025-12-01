export interface UserScript {
  id: string;
  metadata: ScriptMetadata;
  code: string;
  enabled: boolean;
  updatedAt: number;
  history?: ScriptVersion[];
  storage?: Record<string, any>; // Local storage for GM_setValue
  requiresContent?: Record<string, string>; // Cached @require content

  // Flattened metadata fields for easy access
  name: string;
  description: string;
  version: string;
  match: string[];
  exclude: string[];
  runAt: 'document-start' | 'document-end' | 'document-idle' | 'context-menu';
}

export interface ScriptMetadata {
  name: string;
  namespace?: string;
  version?: string;
  description?: string;
  author?: string;
  match: string[];
  exclude: string[];
  include: string[];
  grant: string[];
  require: string[];
  resource: { name: string; url: string }[];
  runAt: 'document-start' | 'document-end' | 'document-idle' | 'context-menu';
  noframes?: boolean;
  connect: string[];
  icon?: string;
}

export interface ScriptVersion {
  timestamp: number;
  code: string;
  version: string;
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

export enum AIProvider {
  GOOGLE = 'GOOGLE',
  DEEPSEEK = 'DEEPSEEK'
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

// Messaging Types
export type GM_Action = 'GM_xmlhttpRequest' | 'GM_setValue' | 'GM_getValue' | 'GM_deleteValue' | 'GM_listValues' | 'GM_notification' | 'GM_setClipboard' | 'GM_download';

export interface GM_Request {
  type: 'GM_API_CALL';
  scriptId: string;
  action: GM_Action;
  args: any[];
  requestId?: string;
}

export interface GM_Response {
  success: boolean;
  data?: any;
  error?: string;
  requestId?: string;
}
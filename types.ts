export interface UserScript {
  id: string;
  name: string;
  description: string;
  version: string;
  match: string[];
  exclude: string[];
  code: string;
  enabled: boolean;
  runAt: 'document-start' | 'document-end' | 'document-idle';
  updatedAt: number;
  history?: ScriptVersion[];
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
  DEEPSEEK = 'DEEPSEEK',
  CUSTOM = 'CUSTOM'
}

export interface CustomAIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
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

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
  html_url: string;
}

export interface GitHubToken {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  clone_url: string;
  default_branch: string;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string;
  encoding?: string;
  download_url: string | null;
}

export interface GitHubFileCommit {
  content: GitHubContent | null;
  commit: {
    sha: string;
    html_url: string;
  };
}

export enum GitHubAuthState {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  AUTHENTICATING = 'AUTHENTICATING',
  AUTHENTICATED = 'AUTHENTICATED',
  ERROR = 'ERROR'
}

export interface GitHubSession {
  user: GitHubUser;
  accessToken: string;
  createdAt: number;
  expiresAt?: number;
}

export interface SyncProgress {
  phase: 'checking' | 'downloading' | 'uploading' | 'importing' | 'completed' | 'error';
  current: number;
  total: number;
  currentFile?: string;
  message?: string;
}

export interface SyncResult {
  success: boolean;
  imported: number;
  uploaded: number;
  skipped: number;
  errors: string[];
  repoCreated: boolean;
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export interface AIGenerationStatus {
  isGenerating: boolean;
  scriptId: string | null;
  scriptName: string;
  progress: string;
  generatedCode?: string;
  error?: string;
}

export interface AIGenerationTask {
  id: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  scriptId: string | null;
  scriptName: string;
  progress: string;
  generatedCode: string;
  error?: string;
  startTime: number;
  requirement: string;
  currentCode?: string;
  contextUrl?: string;
}

import { GitHubUser, GitHubToken, GitHubSession } from '../types';
import { encryptText, decryptText, generateRandomKey } from '../utils/encryption';

interface ChromeStorage {
  local: {
    get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
    set: (items: Record<string, unknown>, callback?: () => void) => void;
    remove: (keys: string[], callback?: () => void) => void;
  };
  runtime: {
    id: string;
  };
}

declare var chrome: { storage: ChromeStorage; runtime: ChromeStorage['runtime'] };

const isExtensionEnv = typeof chrome !== 'undefined' && !!chrome.storage;

const GITHUB_OAUTH_BASE = 'https://github.com/login/oauth';
const GITHUB_API_BASE = 'https://api.github.com';
const SESSION_STORAGE_KEY = 'github_auth_session';
const USER_STORAGE_KEY = 'github_auth_user';
const CLIENT_ID_STORAGE_KEY = 'github_client_id';
const CLIENT_SECRET_STORAGE_KEY = 'github_client_secret';
const DEVICE_CODE_KEY = 'github_device_code';

const USER_AGENT = 'EdgeGenius/1.0';

let cachedSession: GitHubSession | null = null;
let cachedUser: GitHubUser | null = null;
let cachedClientId: string | null = null;
let cachedClientSecret: string | null = null;

async function storageGet(key: string): Promise<string | null> {
  try {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        const storage = chrome.storage.local;
        storage.get([key], (result: Record<string, unknown>) => {
          resolve((result[key] as string) || null);
        });
      });
    } else {
      return localStorage.getItem(key);
    }
  } catch (error) {
    console.error('[GitHubOAuth] Failed to get from storage:', error);
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        const storage = chrome.storage.local;
        storage.set({ [key]: value }, resolve);
      });
    } else {
      localStorage.setItem(key, value);
      return Promise.resolve();
    }
  } catch (error) {
    console.error('[GitHubOAuth] Failed to set storage:', error);
    throw new Error('Failed to save to storage');
  }
}

async function storageRemove(key: string): Promise<void> {
  try {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        const storage = chrome.storage.local;
        storage.remove([key], resolve);
      });
    } else {
      localStorage.removeItem(key);
      return Promise.resolve();
    }
  } catch (error) {
    console.error('[GitHubOAuth] Failed to remove from storage:', error);
  }
}

export async function getStoredClientId(): Promise<string> {
  if (cachedClientId) {
    return cachedClientId;
  }
  const stored = await storageGet(CLIENT_ID_STORAGE_KEY);
  cachedClientId = stored || '';
  return cachedClientId;
}

export async function setStoredClientId(clientId: string): Promise<void> {
  await storageSet(CLIENT_ID_STORAGE_KEY, clientId);
  cachedClientId = clientId;
}

export async function getStoredClientSecret(): Promise<string> {
  if (cachedClientSecret) {
    return cachedClientSecret;
  }
  const stored = await storageGet(CLIENT_SECRET_STORAGE_KEY);
  if (stored) {
    try {
      cachedClientSecret = await decryptText(stored);
    } catch {
      cachedClientSecret = stored;
    }
  } else {
    cachedClientSecret = '';
  }
  return cachedClientSecret;
}

export async function setStoredClientSecret(clientSecret: string): Promise<void> {
  const encrypted = await encryptText(clientSecret);
  await storageSet(CLIENT_SECRET_STORAGE_KEY, encrypted);
  cachedClientSecret = clientSecret;
}

export async function hasGitHubCredentials(): Promise<boolean> {
  const clientId = await getStoredClientId();
  return !!clientId;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface DeviceTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export async function startDeviceFlow(): Promise<DeviceCodeResponse> {
  const clientId = await getStoredClientId();
  if (!clientId) {
    throw new Error('GitHub Client ID not configured. Please configure it in Settings.');
  }

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('scope', 'repo user');

  const response = await fetch(`${GITHUB_OAUTH_BASE}/device/code`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GitHubOAuth] Device flow error:', errorText);
    if (response.status === 422) {
      throw new Error('OAuth App 配置无效。请确保已正确创建 OAuth App 并填写有效的 Client ID。');
    }
    throw new Error(`Failed to start device flow: ${response.status}`);
  }

  const data: DeviceCodeResponse = await response.json();
  
  await storageSet(DEVICE_CODE_KEY, JSON.stringify({
    device_code: data.device_code,
    expires_at: Date.now() + data.expires_in * 1000,
    interval: data.interval
  }));

  return data;
}

export async function pollForToken(deviceCode: string, interval: number = 5): Promise<GitHubToken> {
  const clientId = await getStoredClientId();
  if (!clientId) {
    throw new Error('GitHub Client ID not configured.');
  }

  const poll = async (): Promise<GitHubToken> => {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('device_code', deviceCode);
    params.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');

    const response = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data: DeviceTokenResponse = await response.json();

    if (data.error) {
      if (data.error === 'authorization_pending') {
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
        return poll();
      }
      if (data.error === 'slow_down') {
        await new Promise(resolve => setTimeout(resolve, (interval + 5) * 1000));
        return poll();
      }
      if (data.error === 'expired_token') {
        throw new Error('Authorization timed out. Please try again.');
      }
      if (data.error === 'access_denied') {
        throw new Error('Authorization was denied.');
      }
      throw new Error(data.error_description || data.error);
    }

    return {
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope
    };
  };

  return poll();
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  if (!accessToken || accessToken.trim().length === 0) {
    throw new Error('Access token is required');
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid or expired access token');
      }
      if (response.status === 403) {
        throw new Error('API rate limit exceeded');
      }
      throw new Error(`API request failed with status ${response.status}`);
    }

    const user: GitHubUser = await response.json();
    return user;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get GitHub user info');
  }
}

export async function saveGitHubSession(session: GitHubSession): Promise<void> {
  try {
    const sessionJson = JSON.stringify(session);
    const encryptedSession = await encryptText(sessionJson);
    
    await storageSet(SESSION_STORAGE_KEY, encryptedSession);
    cachedSession = session;
  } catch (error) {
    console.error('[GitHubOAuth] Failed to save session:', error);
    throw new Error('Failed to save GitHub session');
  }
}

export async function getGitHubSession(): Promise<GitHubSession | null> {
  if (cachedSession) {
    if (!cachedSession.expiresAt || cachedSession.expiresAt > Date.now()) {
      return cachedSession;
    }
    cachedSession = null;
    return null;
  }

  const encryptedSession = await storageGet(SESSION_STORAGE_KEY);
  if (!encryptedSession) {
    return null;
  }

  try {
    const decryptedSession = await decryptText(encryptedSession);
    if (!decryptedSession) {
      await clearGitHubSession();
      return null;
    }

    const session: GitHubSession = JSON.parse(decryptedSession);

    if (session.expiresAt && session.expiresAt <= Date.now()) {
      await clearGitHubSession();
      return null;
    }

    cachedSession = session;
    return session;
  } catch (error) {
    console.error('[GitHubOAuth] Failed to decrypt session:', error);
    await clearGitHubSession();
    return null;
  }
}

export async function clearGitHubSession(): Promise<void> {
  await storageRemove(SESSION_STORAGE_KEY);
  await storageRemove(USER_STORAGE_KEY);
  await storageRemove(DEVICE_CODE_KEY);
  cachedSession = null;
  cachedUser = null;
}

export async function loginWithGitHub(): Promise<DeviceCodeResponse> {
  const deviceCode = await startDeviceFlow();
  return deviceCode;
}

export async function completeDeviceAuth(deviceCode: string, interval: number): Promise<GitHubUser> {
  const token = await pollForToken(deviceCode, interval);
  const user = await getGitHubUser(token.access_token);
  
  const session: GitHubSession = {
    user: user,
    accessToken: token.access_token,
    createdAt: Date.now(),
    expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000
  };
  
  await saveGitHubSession(session);
  await storageSet(USER_STORAGE_KEY, JSON.stringify(user));
  cachedUser = user;
  
  return user;
}

export async function getStoredGitHubUser(): Promise<GitHubUser | null> {
  if (cachedUser) {
    return cachedUser;
  }

  const storedUser = await storageGet(USER_STORAGE_KEY);
  if (storedUser) {
    try {
      cachedUser = JSON.parse(storedUser) as GitHubUser;
      return cachedUser;
    } catch {
      console.warn('[GitHubOAuth] Failed to parse stored user info');
    }
  }

  const session = await getGitHubSession();
  if (session) {
    return session.user;
  }

  return null;
}

export async function isGitHubAuthenticated(): Promise<boolean> {
  const session = await getGitHubSession();
  return session !== null;
}

export async function logoutGitHub(): Promise<void> {
  await clearGitHubSession();
}

export function clearCache(): void {
  cachedSession = null;
  cachedUser = null;
  cachedClientId = null;
  cachedClientSecret = null;
}

export function getRedirectUriForDisplay(): string {
  return 'Device Flow (无需回调 URL)';
}

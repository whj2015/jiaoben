import { GitHubUser, GitHubSession } from '../types';
import { encryptText, decryptText } from '../utils/encryption';
import { 
  isExtensionEnv, 
  chromeStorageGet, 
  chromeStorageSet, 
  chromeStorageRemove 
} from '../utils/chromeApi';

const GITHUB_API_BASE = 'https://api.github.com';
const SESSION_STORAGE_KEY = 'github_auth_session';
const USER_STORAGE_KEY = 'github_auth_user';
const TOKEN_STORAGE_KEY = 'github_pat_token';

const USER_AGENT = 'EdgeGenius/1.0';

let cachedSession: GitHubSession | null = null;
let cachedUser: GitHubUser | null = null;
let cachedToken: string | null = null;

export async function getStoredToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }
  const stored = await chromeStorageGet<string>([TOKEN_STORAGE_KEY]);
  const tokenValue = stored[TOKEN_STORAGE_KEY] || '';
  if (tokenValue) {
    try {
      cachedToken = await decryptText(tokenValue);
    } catch {
      cachedToken = tokenValue;
    }
  } else {
    cachedToken = '';
  }
  return cachedToken;
}

export async function setStoredToken(token: string): Promise<void> {
  const encrypted = await encryptText(token);
  await chromeStorageSet({ [TOKEN_STORAGE_KEY]: encrypted });
  cachedToken = token;
}

export async function hasGitHubCredentials(): Promise<boolean> {
  const token = await getStoredToken();
  return !!token;
}

export async function validateToken(token: string): Promise<GitHubUser> {
  if (!token || token.trim().length === 0) {
    throw new Error('Token is required');
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid or expired token');
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
    throw new Error('Failed to validate token');
  }
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  return validateToken(accessToken);
}

export async function saveGitHubSession(session: GitHubSession): Promise<void> {
  try {
    const sessionJson = JSON.stringify(session);
    const encryptedSession = await encryptText(sessionJson);
    
    await chromeStorageSet({ [SESSION_STORAGE_KEY]: encryptedSession });
    cachedSession = session;
  } catch (error) {
    console.error('[GitHubAuth] Failed to save session:', error);
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

  const stored = await chromeStorageGet<string>([SESSION_STORAGE_KEY]);
  const encryptedSession = stored[SESSION_STORAGE_KEY] || '';
  
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
    console.error('[GitHubAuth] Failed to decrypt session:', error);
    await clearGitHubSession();
    return null;
  }
}

export async function clearGitHubSession(): Promise<void> {
  await chromeStorageRemove([SESSION_STORAGE_KEY, USER_STORAGE_KEY, TOKEN_STORAGE_KEY]);
  cachedSession = null;
  cachedUser = null;
  cachedToken = null;
}

export async function loginWithToken(token: string): Promise<GitHubUser> {
  const user = await validateToken(token);
  
  await setStoredToken(token);
  
  const session: GitHubSession = {
    user: user,
    accessToken: token,
    createdAt: Date.now(),
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000
  };
  
  await saveGitHubSession(session);
  await chromeStorageSet({ [USER_STORAGE_KEY]: JSON.stringify(user) });
  cachedUser = user;
  
  return user;
}

export async function getStoredGitHubUser(): Promise<GitHubUser | null> {
  if (cachedUser) {
    return cachedUser;
  }

  const storedUser = await chromeStorageGet<string>([USER_STORAGE_KEY]);
  const userValue = storedUser[USER_STORAGE_KEY] || '';
  
  if (userValue) {
    try {
      cachedUser = JSON.parse(userValue) as GitHubUser;
      return cachedUser;
    } catch {
      console.warn('[GitHubAuth] Failed to parse stored user info');
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
  cachedToken = null;
}

export function getRedirectUriForDisplay(): string {
  return '使用 Personal Access Token 认证';
}

export { getStoredClientId, setStoredClientId } from './githubOAuth';

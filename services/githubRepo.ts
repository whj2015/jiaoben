import { GitHubRepo, GitHubContent, GitHubFileCommit, UserScript } from '../types';
import { getGitHubSession } from './githubAuth';
import { getScripts } from './scriptService';
import { createGitHubError, createRateLimitError, createAuthError } from '../utils/errors';

const GITHUB_API_BASE = 'https://api.github.com';
const USER_AGENT = 'EdgeGenius/1.0';

const DEFAULT_REPO_NAME = 'jiaoben-scripts';
const DEFAULT_REPO_DESCRIPTION = 'Jiaoben 插件脚本同步仓库';

let configuredRepoName: string = DEFAULT_REPO_NAME;

export function getScriptRepoName(): string {
  return configuredRepoName;
}

export function setScriptRepoName(name: string): void {
  configuredRepoName = name || DEFAULT_REPO_NAME;
}

export function toBase64(content: string): string {
  try {
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(content)));
    }
    return Buffer.from(content, 'utf-8').toString('base64');
  } catch (error) {
    console.error('[GitHubRepo] Failed to encode to Base64:', error);
    throw new Error('Failed to encode content to Base64');
  }
}

export function fromBase64(encoded: string): string {
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(encoded)));
    }
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch (error) {
    console.error('[GitHubRepo] Failed to decode from Base64:', error);
    throw new Error('Failed to decode content from Base64');
  }
}

async function getAccessToken(): Promise<string> {
  const session = await getGitHubSession();
  if (!session || !session.accessToken) {
    throw new Error('Not authenticated with GitHub');
  }
  return session.accessToken;
}

async function getOwner(): Promise<string> {
  const session = await getGitHubSession();
  if (!session || !session.user) {
    throw new Error('Not authenticated with GitHub');
  }
  return session.user.login;
}

interface GitHubApiError {
  message: string;
  documentation_url?: string;
}

function createHeaders(accessToken: string): HeadersInit {
  return {
    'Authorization': `token ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/json'
  };
}

async function handleApiError(response: Response, operation: string): Promise<never> {
  let errorMessage = `${operation} failed with status ${response.status}`;
  
  try {
    const errorData = await response.json() as GitHubApiError;
    if (errorData.message) {
      errorMessage = errorData.message;
    }
  } catch {
    // Ignore JSON parse errors
  }

  if (response.status === 404) {
    return null as never;
  }
  
  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    if (rateLimitRemaining === '0') {
      const resetTime = response.headers.get('X-RateLimit-Reset');
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
      throw createRateLimitError(`GitHub API rate limit exceeded. Resets at ${resetDate?.toLocaleString() || 'unknown'}`, resetTime ? parseInt(resetTime) * 1000 : undefined);
    }
    throw createGitHubError(`Permission denied: ${errorMessage}`, response.status);
  }
  
  if (response.status === 401) {
    throw createAuthError('GitHub authentication expired. Please log in again.');
  }

  throw createGitHubError(errorMessage, response.status);
}

export async function checkRepoExists(owner?: string, repo?: string): Promise<GitHubRepo | null> {
  try {
    const accessToken = await getAccessToken();
    const repoOwner = owner || await getOwner();
    const repoName = repo || getScriptRepoName();

    const response = await fetch(`${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}`, {
      method: 'GET',
      headers: createHeaders(accessToken)
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return await handleApiError(response, 'Check repository existence');
    }

    const repoData: GitHubRepo = await response.json();
    return repoData;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not authenticated')) {
      throw error;
    }
    console.error('[GitHubRepo] Failed to check repo existence:', error);
    return null;
  }
}

export async function createScriptRepo(name?: string, description?: string): Promise<GitHubRepo> {
  try {
    const accessToken = await getAccessToken();
    const repoName = name || getScriptRepoName();
    const repoDescription = description || DEFAULT_REPO_DESCRIPTION;

    const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
      method: 'POST',
      headers: createHeaders(accessToken),
      body: JSON.stringify({
        name: repoName,
        description: repoDescription,
        private: true,
        auto_init: true
      })
    });

    if (!response.ok) {
      if (response.status === 422) {
        const errorData = await response.json() as GitHubApiError;
        if (errorData.message?.includes('already exists')) {
          throw new Error(`Repository '${repoName}' already exists`);
        }
      }
      return await handleApiError(response, 'Create repository');
    }

    const repoData: GitHubRepo = await response.json();
    return repoData;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create repository');
  }
}

export async function getRepoContents(
  path: string = '',
  owner?: string,
  repo?: string,
  ref?: string
): Promise<GitHubContent[] | GitHubContent> {
  try {
    const accessToken = await getAccessToken();
    const repoOwner = owner || await getOwner();
    const repoName = repo || getScriptRepoName();

    let url = `${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`;
    if (ref) {
      url += `?ref=${encodeURIComponent(ref)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders(accessToken)
    });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      return await handleApiError(response, 'Get repository contents');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not authenticated')) {
      throw error;
    }
    console.error('[GitHubRepo] Failed to get repo contents:', error);
    return [];
  }
}

export async function getFileContent(
  path: string,
  owner?: string,
  repo?: string,
  ref?: string
): Promise<string | null> {
  try {
    const accessToken = await getAccessToken();
    const repoOwner = owner || await getOwner();
    const repoName = repo || getScriptRepoName();

    let url = `${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`;
    if (ref) {
      url += `?ref=${encodeURIComponent(ref)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders(accessToken)
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return await handleApiError(response, 'Get file content');
    }

    const data: GitHubContent = await response.json();
    
    if (data.type !== 'file' || !data.content) {
      return null;
    }

    return fromBase64(data.content.replace(/\n/g, ''));
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not authenticated')) {
      throw error;
    }
    console.error('[GitHubRepo] Failed to get file content:', error);
    return null;
  }
}

export async function uploadFile(
  path: string,
  message: string,
  content: string,
  sha?: string,
  owner?: string,
  repo?: string
): Promise<GitHubFileCommit> {
  try {
    const accessToken = await getAccessToken();
    const repoOwner = owner || await getOwner();
    const repoName = repo || getScriptRepoName();

    const body: Record<string, string> = {
      message,
      content: toBase64(content)
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(`${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`, {
      method: 'PUT',
      headers: createHeaders(accessToken),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('File conflict - please retry');
      }
      return await handleApiError(response, sha ? 'Update file' : 'Upload file');
    }

    const result: GitHubFileCommit = await response.json();
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to upload file');
  }
}

export async function uploadAllScripts(
  owner?: string,
  repo?: string,
  concurrency: number = 5
): Promise<{ uploaded: number; errors: string[] }> {
  const result = {
    uploaded: 0,
    errors: [] as string[]
  };

  try {
    const scripts = await getScripts();
    
    if (scripts.length === 0) {
      return result;
    }

    const accessToken = await getAccessToken();
    const repoOwner = owner || await getOwner();
    const repoName = repo || getScriptRepoName();

    const uploadSingleScriptWithRetry = async (script: typeof scripts[0]): Promise<{ success: boolean; error?: string }> => {
      const fileName = `${script.name.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_')}.user.js`;
      const path = fileName;

      const getExistingFileSha = async (): Promise<string | null> => {
        try {
          const response = await fetch(`${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`, {
            method: 'GET',
            headers: createHeaders(accessToken)
          });
          
          if (response.ok) {
            const existingFile = await response.json() as GitHubContent;
            return existingFile?.sha || null;
          }
          return null;
        } catch {
          return null;
        }
      };

      const uploadWithSha = async (sha: string | null): Promise<{ success: boolean; error?: string; needRetry?: boolean }> => {
        const message = sha 
          ? `Update script: ${script.name}` 
          : `Add script: ${script.name}`;

        const body: Record<string, string> = {
          message,
          content: toBase64(script.code)
        };

        if (sha) {
          body.sha = sha;
        }

        const uploadResponse = await fetch(`${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`, {
          method: 'PUT',
          headers: createHeaders(accessToken),
          body: JSON.stringify(body)
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          const errorMsg = errorData.message || `HTTP ${uploadResponse.status}`;
          
          if (uploadResponse.status === 409 || 
              (uploadResponse.status === 422 && errorMsg.includes('sha'))) {
            return { success: false, error: errorMsg, needRetry: true };
          }
          
          return { success: false, error: errorMsg };
        }

        return { success: true };
      };

      let existingSha = await getExistingFileSha();
      let result = await uploadWithSha(existingSha);
      
      if (result.needRetry) {
        existingSha = await getExistingFileSha();
        if (existingSha) {
          result = await uploadWithSha(existingSha);
        }
      }

      return { success: result.success, error: result.error };
    };

    const chunks: UserScript[][] = [];
    for (let i = 0; i < scripts.length; i += concurrency) {
      chunks.push(scripts.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(script => uploadSingleScriptWithRetry(script))
      );

      results.forEach((settledResult, index) => {
        const script = chunk[index];
        if (settledResult.status === 'fulfilled') {
          if (settledResult.value.success) {
            result.uploaded++;
          } else {
            result.errors.push(`Failed to upload '${script.name}': ${settledResult.value.error}`);
          }
        } else {
          const errorMsg = settledResult.reason instanceof Error ? settledResult.reason.message : 'Unknown error';
          result.errors.push(`Failed to upload '${script.name}': ${errorMsg}`);
          console.error(`[GitHubRepo] Failed to upload script '${script.name}':`, settledResult.reason);
        }
      });
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to upload scripts');
  }
}

export async function deleteFile(
  path: string,
  message: string,
  sha: string,
  owner?: string,
  repo?: string
): Promise<void> {
  try {
    const accessToken = await getAccessToken();
    const repoOwner = owner || await getOwner();
    const repoName = repo || getScriptRepoName();

    const response = await fetch(`${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`, {
      method: 'DELETE',
      headers: createHeaders(accessToken),
      body: JSON.stringify({
        message,
        sha
      })
    });

    if (!response.ok) {
      return await handleApiError(response, 'Delete file');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to delete file');
  }
}

export async function getFileSha(
  path: string,
  owner?: string,
  repo?: string
): Promise<string | null> {
  try {
    const contents = await getRepoContents(path, owner, repo) as GitHubContent;
    if (contents && contents.sha) {
      return contents.sha;
    }
    return null;
  } catch {
    return null;
  }
}

export async function ensureRepoExists(): Promise<GitHubRepo> {
  let repo = await checkRepoExists();
  
  if (!repo) {
    repo = await createScriptRepo();
  }
  
  return repo;
}

export async function uploadSingleScript(
  script: { name: string; code: string },
  owner?: string,
  repo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    const repoOwner = owner || await getOwner();
    const repoName = repo || getScriptRepoName();

    const fileName = `${script.name.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_')}.user.js`;
    const path = fileName;

    const getExistingFileSha = async (): Promise<string | null> => {
      try {
        const response = await fetch(`${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`, {
          method: 'GET',
          headers: createHeaders(accessToken)
        });
        
        if (response.ok) {
          const existingFile = await response.json() as GitHubContent;
          return existingFile?.sha || null;
        }
        return null;
      } catch {
        return null;
      }
    };

    let existingSha = await getExistingFileSha();

    const uploadWithSha = async (sha: string | null): Promise<{ success: boolean; error?: string; needRetry?: boolean }> => {
      const message = sha 
        ? `Update script: ${script.name}` 
        : `Add script: ${script.name}`;

      const body: Record<string, string> = {
        message,
        content: toBase64(script.code)
      };

      if (sha) {
        body.sha = sha;
      }

      const uploadResponse = await fetch(`${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`, {
        method: 'PUT',
        headers: createHeaders(accessToken),
        body: JSON.stringify(body)
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        const errorMsg = errorData.message || `HTTP ${uploadResponse.status}`;
        
        if (uploadResponse.status === 409 || 
            (uploadResponse.status === 422 && errorMsg.includes('sha'))) {
          return { success: false, error: errorMsg, needRetry: true };
        }
        
        return { success: false, error: errorMsg };
      }

      return { success: true };
    };

    let result = await uploadWithSha(existingSha);
    
    if (result.needRetry) {
      existingSha = await getExistingFileSha();
      if (existingSha) {
        result = await uploadWithSha(existingSha);
      }
    }

    return { success: result.success, error: result.error };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GitHubRepo] Failed to upload script '${script.name}':`, error);
    return { success: false, error: errorMsg };
  }
}

export async function checkScriptExistsInRepo(
  scriptName: string,
  owner?: string,
  repo?: string
): Promise<{ exists: boolean; sha?: string }> {
  try {
    const accessToken = await getAccessToken();
    const repoOwner = owner || await getOwner();
    const repoName = repo || getScriptRepoName();

    const fileName = `${scriptName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_')}.user.js`;
    const path = fileName;

    const response = await fetch(`${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`, {
      method: 'GET',
      headers: createHeaders(accessToken)
    });

    if (response.status === 404) {
      return { exists: false };
    }

    if (!response.ok) {
      return { exists: false };
    }

    const file = await response.json() as GitHubContent;
    return { exists: true, sha: file.sha };
  } catch (error) {
    console.error('[GitHubRepo] Failed to check script existence:', error);
    return { exists: false };
  }
}

export async function deleteScriptFromRepo(
  scriptName: string,
  owner?: string,
  repo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    const repoOwner = owner || await getOwner();
    const repoName = repo || getScriptRepoName();

    const fileName = `${scriptName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_')}.user.js`;
    const path = fileName;

    const checkResult = await checkScriptExistsInRepo(scriptName, owner, repo);
    if (!checkResult.exists || !checkResult.sha) {
      return { success: true };
    }

    const response = await fetch(`${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}`, {
      method: 'DELETE',
      headers: createHeaders(accessToken),
      body: JSON.stringify({
        message: `Delete script: ${scriptName}`,
        sha: checkResult.sha
      })
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorMsg;
      } catch {
        // Ignore
      }
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GitHubRepo] Failed to delete script '${scriptName}':`, error);
    return { success: false, error: errorMsg };
  }
}

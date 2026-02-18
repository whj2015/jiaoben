import { formatResetTime } from './githubRateLimit';

export type GitHubErrorType = 'network' | 'auth' | 'rate_limit' | 'not_found' | 'permission' | 'validation' | 'unknown';

export interface GitHubError {
  type: GitHubErrorType;
  message: string;
  originalError?: unknown;
  resetTime?: number;
}

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export function parseGitHubError(error: unknown): GitHubError {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: '网络连接失败，请检查网络设置',
      originalError: error,
    };
  }

  if (error instanceof Error) {
    const httpMatch = error.message.match(/(\d{3})/);
    if (httpMatch) {
      const status = parseInt(httpMatch[1], 10);
      return parseHttpError(status, error);
    }

    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused')) {
      return {
        type: 'network',
        message: '网络请求超时或连接失败',
        originalError: error,
      };
    }

    if (message.includes('unauthorized') || message.includes('invalid token') || message.includes('bad credentials')) {
      return {
        type: 'auth',
        message: 'GitHub 认证失败，请检查 Token 是否有效',
        originalError: error,
      };
    }

    if (message.includes('rate limit') || message.includes('api rate limit exceeded')) {
      return {
        type: 'rate_limit',
        message: 'GitHub API 速率限制已超出',
        originalError: error,
      };
    }

    if (message.includes('not found') || message.includes('404')) {
      return {
        type: 'not_found',
        message: '请求的资源不存在',
        originalError: error,
      };
    }

    if (message.includes('forbidden') || message.includes('permission') || message.includes('access denied')) {
      return {
        type: 'permission',
        message: '权限不足，无法访问该资源',
        originalError: error,
      };
    }
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    
    if (err.status !== undefined) {
      return parseHttpError(err.status as number, error);
    }

    if (err.response !== undefined && typeof err.response === 'object' && err.response !== null) {
      const response = err.response as Record<string, unknown>;
      if (response.status !== undefined) {
        return parseHttpError(response.status as number, error);
      }
    }
  }

  return {
    type: 'unknown',
    message: '发生未知错误',
    originalError: error,
  };
}

function parseHttpError(status: number, error: unknown): GitHubError {
  let resetTime: number | undefined;

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    const headers = err.headers as Record<string, unknown> | undefined;
    if (headers && typeof headers.get === 'function') {
      const resetHeader = headers.get('X-RateLimit-Reset');
      if (resetHeader) {
        resetTime = parseInt(resetHeader, 10);
      }
    }

    if (err.response !== undefined && typeof err.response === 'object' && err.response !== null) {
      const response = err.response as Record<string, unknown>;
      const respHeaders = response.headers as Record<string, unknown> | undefined;
      if (respHeaders && typeof respHeaders.get === 'function') {
        const resetHeader = respHeaders.get('X-RateLimit-Reset');
        if (resetHeader) {
          resetTime = parseInt(resetHeader, 10);
        }
      }
    }
  }

  switch (status) {
    case 401:
      return {
        type: 'auth',
        message: 'GitHub 认证失败，Token 无效或已过期',
        originalError: error,
      };
    case 403:
      return {
        type: 'rate_limit',
        message: 'GitHub API 速率限制已超出',
        originalError: error,
        resetTime,
      };
    case 404:
      return {
        type: 'not_found',
        message: '请求的 GitHub 资源不存在',
        originalError: error,
      };
    case 422:
      return {
        type: 'validation',
        message: '请求参数验证失败',
        originalError: error,
      };
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        type: 'network',
        message: `GitHub 服务器错误 (${status})`,
        originalError: error,
      };
    default:
      return {
        type: 'unknown',
        message: `HTTP 错误: ${status}`,
        originalError: error,
      };
  }
}

export async function handleNetworkError<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const githubError = parseGitHubError(error);

      if (githubError.type === 'auth' || githubError.type === 'not_found' || githubError.type === 'permission') {
        throw githubError;
      }

      if (attempt < maxRetries - 1) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw parseGitHubError(lastError);
}

export function formatGitHubError(
  error: GitHubError,
  t?: (key: string, options?: Record<string, unknown>) => string
): string {
  const translate = t || ((key: string) => key);

  switch (error.type) {
    case 'network':
      return translate('errors.network', { message: error.message });
    case 'auth':
      return translate('errors.auth', { message: error.message });
    case 'rate_limit':
      const resetTimeStr = error.resetTime ? formatResetTime(error.resetTime) : '';
      return translate('errors.rateLimit', {
        message: error.message,
        resetTime: resetTimeStr,
      });
    case 'not_found':
      return translate('errors.notFound', { message: error.message });
    case 'permission':
      return translate('errors.permission', { message: error.message });
    default:
      return translate('errors.unknown', { message: error.message });
  }
}

export function isAuthError(error: unknown): boolean {
  const githubError = error as GitHubError;
  if (githubError && typeof githubError === 'object' && 'type' in githubError) {
    return githubError.type === 'auth';
  }

  const parsed = parseGitHubError(error);
  return parsed.type === 'auth';
}

export function isRateLimitError(error: unknown): boolean {
  const githubError = error as GitHubError;
  if (githubError && typeof githubError === 'object' && 'type' in githubError) {
    return githubError.type === 'rate_limit';
  }

  const parsed = parseGitHubError(error);
  return parsed.type === 'rate_limit';
}

export function getErrorSuggestion(error: GitHubError): string {
  switch (error.type) {
    case 'network':
      return '请检查网络连接，确保可以访问 GitHub API。如果问题持续存在，请稍后重试。';
    case 'auth':
      return '请检查您的 GitHub Token 是否正确配置。您可以在设置中更新 Token，确保它具有所需的权限范围。';
    case 'rate_limit':
      if (error.resetTime) {
        const resetStr = formatResetTime(error.resetTime);
        return `API 速率限制将在 ${resetStr} 重置。请等待限制重置后再试，或使用认证 Token 获取更高的速率限制。`;
      }
      return '请等待一段时间后重试，或使用认证 Token 获取更高的速率限制配额。';
    case 'not_found':
      return '请确认请求的资源（仓库、用户、文件等）确实存在，并且您有权限访问它。';
    case 'permission':
      return '请确保您的 Token 具有所需的权限范围（如 repo、user 等）。您可能需要重新授权或联系仓库管理员。';
    default:
      return '如果问题持续存在，请查看控制台日志获取更多信息，或联系技术支持。';
  }
}

export function createGitHubError(
  type: GitHubErrorType,
  message: string,
  originalError?: unknown,
  resetTime?: number
): GitHubError {
  return {
    type,
    message,
    originalError,
    resetTime,
  };
}

export function isGitHubError(error: unknown): error is GitHubError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    typeof (error as GitHubError).type === 'string' &&
    typeof (error as GitHubError).message === 'string'
  );
}

export async function withGitHubErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const githubError = parseGitHubError(error);
    if (context) {
      console.error(`[GitHubError] ${context}:`, githubError);
    }
    throw githubError;
  }
}

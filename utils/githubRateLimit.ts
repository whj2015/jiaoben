import { GitHubRateLimit } from '../types';

const RATE_LIMIT_THRESHOLD = 10;
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export async function checkRateLimit(token?: string): Promise<GitHubRateLimit> {
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('https://api.github.com/rate_limit', {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to check rate limit: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: data.rate.reset,
    used: data.rate.used,
  };
}

export function waitForRateLimit(resetTime: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const waitSeconds = resetTime - now;

  if (waitSeconds <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, waitSeconds * 1000);
  });
}

export async function withRateLimitHandling<T>(
  requestFn: () => Promise<T>,
  token?: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await requestFn();
      return result;
    } catch (error) {
      const err = error as Error & { status?: number; response?: Response };

      if (err.status === 403 || (err.response && err.response.status === 403)) {
        const isRateLimitError = await isRateLimitExceeded(err.response);

        if (isRateLimitError) {
          lastError = err;

          if (attempt < MAX_RETRIES - 1) {
            try {
              const rateLimit = await checkRateLimit(token);
              await waitForRateLimit(rateLimit.reset);
            } catch {
              await delayRequest(BASE_DELAY * Math.pow(2, attempt));
            }
            continue;
          }
        }
      }

      throw error;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

async function isRateLimitExceeded(response?: Response): Promise<boolean> {
  if (!response) {
    return false;
  }

  const remaining = response.headers.get('X-RateLimit-Remaining');
  if (remaining !== null && parseInt(remaining, 10) === 0) {
    return true;
  }

  try {
    const body = await response.clone().text();
    return body.includes('rate limit') || body.includes('API rate limit exceeded');
  } catch {
    return false;
  }
}

export function shouldDelayRequest(rateLimit: GitHubRateLimit): {
  shouldDelay: boolean;
  waitTime?: number;
} {
  if (rateLimit.remaining <= RATE_LIMIT_THRESHOLD) {
    const now = Math.floor(Date.now() / 1000);
    const waitTime = Math.max(0, rateLimit.reset - now) * 1000;
    return { shouldDelay: true, waitTime };
  }

  return { shouldDelay: false };
}

export function delayRequest(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function getRateLimitFromHeaders(headers: Headers): GitHubRateLimit | null {
  const limit = headers.get('X-RateLimit-Limit');
  const remaining = headers.get('X-RateLimit-Remaining');
  const reset = headers.get('X-RateLimit-Reset');
  const used = headers.get('X-RateLimit-Used');

  if (!limit || !remaining || !reset) {
    return null;
  }

  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    reset: parseInt(reset, 10),
    used: used ? parseInt(used, 10) : parseInt(limit, 10) - parseInt(remaining, 10),
  };
}

export function formatResetTime(resetTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diffSeconds = resetTimestamp - now;

  if (diffSeconds <= 0) {
    return '已重置';
  }

  if (diffSeconds < 60) {
    return `${diffSeconds} 秒后`;
  }

  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    return seconds > 0 ? `${minutes} 分 ${seconds} 秒后` : `${minutes} 分钟后`;
  }

  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    return minutes > 0 ? `${hours} 小时 ${minutes} 分钟后` : `${hours} 小时后`;
  }

  const days = Math.floor(diffSeconds / 86400);
  const hours = Math.floor((diffSeconds % 86400) / 3600);
  return hours > 0 ? `${days} 天 ${hours} 小时后` : `${days} 天后`;
}

export const config = {
  RATE_LIMIT_THRESHOLD,
  MAX_RETRIES,
  BASE_DELAY,
};

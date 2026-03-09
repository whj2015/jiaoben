export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  static fromUnknown(error: unknown, defaultCode: string = 'UNKNOWN_ERROR'): AppError {
    if (error instanceof AppError) {
      return error;
    }
    if (error instanceof Error) {
      return new AppError(error.message, defaultCode);
    }
    return new AppError(String(error), defaultCode);
  }
}

export const ErrorCodes = {
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  AI_API_ERROR: 'AI_API_ERROR',
  SCRIPT_ERROR: 'SCRIPT_ERROR',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;

export function getErrorMessage(error: unknown, fallback: string = 'An error occurred'): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.code === ErrorCodes.NETWORK_ERROR;
  }
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  return false;
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.code === ErrorCodes.RATE_LIMIT_ERROR;
  }
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('rate limit');
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.code === ErrorCodes.AUTH_ERROR;
  }
  if (error instanceof Error) {
    return (
      error.message.includes('401') ||
      error.message.toLowerCase().includes('unauthorized') ||
      error.message.toLowerCase().includes('authentication')
    );
  }
  return false;
}

export function createNetworkError(message: string, statusCode?: number): AppError {
  return new AppError(message, ErrorCodes.NETWORK_ERROR, statusCode);
}

export function createStorageError(message: string, details?: unknown): AppError {
  return new AppError(message, ErrorCodes.STORAGE_ERROR, undefined, details);
}

export function createValidationError(message: string, details?: unknown): AppError {
  return new AppError(message, ErrorCodes.VALIDATION_ERROR, undefined, details);
}

export function createAuthError(message: string): AppError {
  return new AppError(message, ErrorCodes.AUTH_ERROR);
}

export function createGitHubError(message: string, statusCode?: number): AppError {
  return new AppError(message, ErrorCodes.GITHUB_API_ERROR, statusCode);
}

export function createAIError(message: string, details?: unknown): AppError {
  return new AppError(message, ErrorCodes.AI_API_ERROR, undefined, details);
}

export function createRateLimitError(message: string, resetTime?: number): AppError {
  return new AppError(message, ErrorCodes.RATE_LIMIT_ERROR, 429, { resetTime });
}

export function createTimeoutError(message: string = 'Request timeout'): AppError {
  return new AppError(message, ErrorCodes.TIMEOUT_ERROR);
}

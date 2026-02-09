/**
 * 统一错误处理模块
 * 提供标准化的错误处理、错误分类和用户友好的错误消息
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  STORAGE = 'STORAGE',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  ENCRYPTION = 'ENCRYPTION',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  originalError?: Error | unknown;
  timestamp: number;
  context?: Record<string, unknown>;
}

/**
 * 错误消息映射表
 * 根据错误类型和严重程度提供用户友好的错误消息
 */
const ERROR_MESSAGES: Record<ErrorType, Record<ErrorSeverity, string>> = {
  [ErrorType.NETWORK]: {
    [ErrorSeverity.LOW]: '网络连接不稳定，请稍后重试',
    [ErrorSeverity.MEDIUM]: '网络请求失败，请检查网络连接',
    [ErrorSeverity.HIGH]: '网络错误，无法连接到服务器',
    [ErrorSeverity.CRITICAL]: '严重网络错误，请稍后再试'
  },
  [ErrorType.VALIDATION]: {
    [ErrorSeverity.LOW]: '输入格式不正确',
    [ErrorSeverity.MEDIUM]: '输入验证失败，请检查输入内容',
    [ErrorSeverity.HIGH]: '无效的输入数据',
    [ErrorSeverity.CRITICAL]: '输入数据存在严重问题'
  },
  [ErrorType.STORAGE]: {
    [ErrorSeverity.LOW]: '存储空间不足',
    [ErrorSeverity.MEDIUM]: '无法保存数据',
    [ErrorSeverity.HIGH]: '存储操作失败',
    [ErrorSeverity.CRITICAL]: '严重存储错误'
  },
  [ErrorType.AUTHENTICATION]: {
    [ErrorSeverity.LOW]: '认证信息可能过期',
    [ErrorSeverity.MEDIUM]: '认证失败，请重新登录',
    [ErrorSeverity.HIGH]: '无效的认证凭据',
    [ErrorSeverity.CRITICAL]: '认证系统错误'
  },
  [ErrorType.PERMISSION]: {
    [ErrorSeverity.LOW]: '权限不足',
    [ErrorSeverity.MEDIUM]: '需要更多权限',
    [ErrorSeverity.HIGH]: '权限被拒绝',
    [ErrorSeverity.CRITICAL]: '严重权限错误'
  },
  [ErrorType.ENCRYPTION]: {
    [ErrorSeverity.LOW]: '加密操作失败',
    [ErrorSeverity.MEDIUM]: '无法加密数据',
    [ErrorSeverity.HIGH]: '加密系统错误',
    [ErrorSeverity.CRITICAL]: '严重加密错误'
  },
  [ErrorType.UNKNOWN]: {
    [ErrorSeverity.LOW]: '发生未知错误',
    [ErrorSeverity.MEDIUM]: '操作失败',
    [ErrorSeverity.HIGH]: '系统错误',
    [ErrorSeverity.CRITICAL]: '严重系统错误'
  }
};

/**
 * 创建应用错误对象
 * @param type - 错误类型
 * @param severity - 错误严重程度
 * @param message - 技术错误消息
 * @param originalError - 原始错误对象
 * @param context - 错误上下文信息
 * @returns 应用错误对象
 */
export function createAppError(
  type: ErrorType,
  severity: ErrorSeverity,
  message: string,
  originalError?: Error | unknown,
  context?: Record<string, unknown>
): AppError {
  return {
    type,
    severity,
    message,
    userMessage: ERROR_MESSAGES[type][severity],
    originalError,
    timestamp: Date.now(),
    context
  };
}

/**
 * 从原始错误创建应用错误
 * @param error - 原始错误
 * @param context - 错误上下文信息
 * @returns 应用错误对象
 */
export function createErrorFromUnknown(error: Error | unknown, context?: Record<string, unknown>): AppError {
  const timestamp = Date.now();
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      type = ErrorType.NETWORK;
    } else if (message.includes('storage') || message.includes('quota')) {
      type = ErrorType.STORAGE;
    } else if (message.includes('auth') || message.includes('permission')) {
      type = ErrorType.AUTHENTICATION;
    } else if (message.includes('encrypt') || message.includes('decrypt')) {
      type = ErrorType.ENCRYPTION;
    } else if (message.includes('invalid') || message.includes('validation')) {
      type = ErrorType.VALIDATION;
    }
    
    return {
      type,
      severity,
      message: error.message,
      userMessage: ERROR_MESSAGES[type][severity],
      originalError: error,
      timestamp,
      context
    };
  }
  
  return createAppError(
    ErrorType.UNKNOWN,
    ErrorSeverity.MEDIUM,
    String(error),
    error,
    context
  );
}

/**
 * 处理错误并返回用户友好的消息
 * @param error - 错误对象
 * @param context - 错误上下文信息
 * @returns 用户友好的错误消息
 */
export function handleUserError(error: Error | unknown, context?: Record<string, unknown>): string {
  const appError = createErrorFromUnknown(error, context);
  
  if (appError.severity === ErrorSeverity.CRITICAL) {
    console.error('[ErrorHandler] Critical error:', appError);
  } else if (appError.severity === ErrorSeverity.HIGH) {
    console.error('[ErrorHandler] High severity error:', appError);
  } else {
    console.warn('[ErrorHandler] Error:', appError);
  }
  
  return appError.userMessage;
}

/**
 * 异步错误处理包装器
 * 自动捕获并处理异步函数中的错误
 * @param fn - 异步函数
 * @param context - 错误上下文信息
 * @returns 包装后的异步函数
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = createErrorFromUnknown(error, context);
      console.error('[ErrorHandler] Async error:', appError);
      throw appError;
    }
  }) as T;
}

/**
 * 错误边界错误处理器
 * 用于 React Error Boundary
 * @param error - 错误对象
 * @param errorInfo - 错误信息
 * @returns 应用错误对象
 */
export function handleBoundaryError(error: Error, errorInfo: { componentStack: string }): AppError {
  return createAppError(
    ErrorType.UNKNOWN,
    ErrorSeverity.HIGH,
    `Component error: ${error.message}`,
    error,
    {
      componentStack: errorInfo.componentStack
    }
  );
}

/**
 * 存储错误处理器
 * 专门处理存储相关错误
 * @param error - 存储错误
 * @param operation - 操作类型（get/set/delete）
 * @returns 应用错误对象
 */
export function handleStorageError(error: Error | unknown, operation: string): AppError {
  const message = `Storage ${operation} failed`;
  
  if (error instanceof Error) {
    if (error.message.includes('quota')) {
      return createAppError(
        ErrorType.STORAGE,
        ErrorSeverity.HIGH,
        message,
        error,
        { operation }
      );
    }
  }
  
  return createErrorFromUnknown(error, { operation });
}

/**
 * 网络错误处理器
 * 专门处理网络相关错误
 * @param error - 网络错误
 * @param url - 请求的 URL
 * @returns 应用错误对象
 */
export function handleNetworkError(error: Error | unknown, url?: string): AppError {
  const message = url ? `Network request failed: ${url}` : 'Network request failed';
  
  if (error instanceof Error) {
    let severity = ErrorSeverity.MEDIUM;
    
    if (error.message.includes('timeout')) {
      severity = ErrorSeverity.HIGH;
    } else if (error.message.includes('abort')) {
      severity = ErrorSeverity.LOW;
    }
    
    return createAppError(
      ErrorType.NETWORK,
      severity,
      message,
      error,
      { url }
    );
  }
  
  return createErrorFromUnknown(error, { url });
}

/**
 * 格式化错误消息用于显示
 * @param error - 应用错误对象
 * @param includeDetails - 是否包含详细信息
 * @returns 格式化后的错误消息
 */
export function formatErrorMessage(error: AppError, includeDetails: boolean = false): string {
  let message = error.userMessage;
  
  if (includeDetails && error.context) {
    const details = Object.entries(error.context)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(', ');
    message += ` (${details})`;
  }
  
  return message;
}

/**
 * 错误重试策略
 * @param fn - 需要重试的函数
 * @param maxRetries - 最大重试次数
 * @param delay - 重试延迟（毫秒）
 * @returns 重试包装后的函数
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw createErrorFromUnknown(lastError, { retries: maxRetries });
}

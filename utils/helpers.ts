/**
 * 通用工具函数集合
 * 提供项目中常用的辅助函数，避免代码重复
 */

/**
 * 转义 HTML 特殊字符，防止 XSS 攻击
 * @param unsafe - 需要转义的字符串
 * @returns 转义后的安全字符串
 */
export const escapeHtml = (unsafe: string): string => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * 验证并清理 URL
 * @param url - 需要验证的 URL
 * @param allowedProtocols - 允许的协议列表
 * @returns 验证后的安全 URL，如果无效则返回空字符串
 */
export const validateAndCleanUrl = (url: string, allowedProtocols: string[] = ['http:', 'https:', 'ftp:', 'file:']): string => {
  if (!url || typeof url !== 'string') return '';
  
  try {
    const parsed = new URL(url.trim());
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      return '';
    }
    
    if (parsed.hostname.includes('..') || parsed.pathname.includes('..')) {
      return '';
    }
    
    return url.trim();
  } catch {
    return '';
  }
};

/**
 * 验证文件名
 * @param filename - 需要验证的文件名
 * @param maxLength - 最大长度限制
 * @returns 是否为有效文件名
 */
export const validateFilename = (filename: string, maxLength: number = 200): boolean => {
  if (!filename || typeof filename !== 'string') return false;
  if (filename.trim().length === 0) return false;
  if (filename.length > maxLength) return false;
  
  const invalidChars = /[<>:"/\\|?*\x00-\x1F\x7F]/;
  if (invalidChars.test(filename)) return false;
  
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedNames.test(filename.split('.')[0])) return false;
  
  return true;
};

/**
 * 验证脚本代码
 * @param code - 脚本代码
 * @param maxSize - 最大大小限制（字节）
 * @returns 验证结果
 */
export const validateScriptCode = (code: string, maxSize: number = 1024 * 1024): { valid: boolean; error?: string } => {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: '代码不能为空' };
  }
  
  if (code.length > maxSize) {
    return { valid: false, error: `代码大小超过限制 (${maxSize} 字节)` };
  }
  
  if (code.length === 0) {
    return { valid: false, error: '代码不能为空' };
  }
  
  return { valid: true };
};

/**
 * 验证 API Key
 * @param apiKey - API Key
 * @param minLength - 最小长度
 * @returns 验证结果
 */
export const validateApiKey = (apiKey: string, minLength: number = 10): { valid: boolean; error?: string } => {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API Key 不能为空' };
  }
  
  const trimmed = apiKey.trim();
  if (trimmed.length < minLength) {
    return { valid: false, error: `API Key 长度不能少于 ${minLength} 个字符` };
  }
  
  if (trimmed.length > 500) {
    return { valid: false, error: 'API Key 长度不能超过 500 个字符' };
  }
  
  return { valid: true };
};

/**
 * 清理用户输入
 * @param input - 用户输入
 * @param maxLength - 最大长度限制
 * @param removeControlChars - 是否移除控制字符
 * @returns 清理后的安全输入
 */
export const sanitizeUserInput = (
  input: string,
  maxLength: number = 10000,
  removeControlChars: boolean = true
): string => {
  if (!input) return '';
  
  let sanitized = input.trim();
  
  if (removeControlChars) {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
};

/**
 * 防抖函数
 * 在指定时间内多次调用只执行最后一次
 * @param func - 需要防抖的函数
 * @param wait - 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * 节流函数
 * 在指定时间内只执行一次
 * @param func - 需要节流的函数
 * @param limit - 时间限制（毫秒）
 * @returns 节流后的函数
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * 生成唯一 ID
 * @returns 唯一标识符
 */
export const generateUniqueId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};

/**
 * 格式化时间戳为本地化字符串
 * @param timestamp - 时间戳
 * @returns 格式化后的时间字符串
 */
export const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return '--/--';
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 深度克隆对象
 * @param obj - 需要克隆的对象
 * @returns 克隆后的对象
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  
  const clonedObj = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
};

/**
 * 验证 URL 是否有效
 * @param url - 需要验证的 URL
 * @returns 是否为有效 URL
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'ftp:', 'file:'];
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * 截断字符串到指定长度
 * @param str - 需要截断的字符串
 * @param maxLength - 最大长度
 * @param suffix - 截断后添加的后缀（默认为 '...'）
 * @returns 截断后的字符串
 */
export const truncateString = (
  str: string,
  maxLength: number,
  suffix: string = '...'
): string => {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * 清理文件名中的非法字符
 * @param filename - 需要清理的文件名
 * @returns 清理后的文件名
 */
export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .substring(0, 200);
};

/**
 * 检查是否为空值（null、undefined、空字符串、空数组、空对象）
 * @param value - 需要检查的值
 * @returns 是否为空值
 */
export const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * 验证数字范围
 * @param value - 需要验证的值
 * @param min - 最小值
 * @param max - 最大值
 * @returns 是否在有效范围内
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * 安全的 JSON 解析
 * @param json - JSON 字符串
 * @param defaultValue - 解析失败时的默认值
 * @returns 解析后的对象或默认值
 */
export const safeJsonParse = <T>(json: string, defaultValue: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
};

/**
 * 验证电子邮件格式
 * @param email - 电子邮件地址
 * @returns 是否为有效的电子邮件格式
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 验证正则表达式模式
 * @param pattern - 正则表达式字符串
 * @returns 是否为有效的正则表达式
 */
export const isValidRegex = (pattern: string): boolean => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

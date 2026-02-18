export const escapeHtml = (unsafe: string): string => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

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

export const generateUniqueId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};

export const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return '--/--';
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

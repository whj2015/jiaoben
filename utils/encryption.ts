/**
 * 加密解密工具模块
 * 使用 Web Crypto API 提供安全的加密解密功能
 */

// 从环境变量或运行时获取密钥，避免硬编码
const getEncryptionKey = (): string => {
  if (typeof process !== 'undefined' && process.env?.ENCRYPTION_KEY) {
    return process.env.ENCRYPTION_KEY;
  }
  // 使用浏览器指纹 + 随机生成的设备特定密钥
  return getDeviceSpecificKey();
};

// 内存中的密钥缓存（用于测试环境或 localStorage 不可用的情况）
let memoryKey: string | null = null;

// 生成设备特定的密钥
const getDeviceSpecificKey = (): string => {
  const storageKey = 'edgegenius_device_key';
  
  // 如果内存中有密钥，直接返回
  if (memoryKey) {
    return memoryKey;
  }
  
  // 尝试从 storage 获取现有密钥
  if (typeof localStorage !== 'undefined' && localStorage.getItem) {
    try {
      const existingKey = localStorage.getItem(storageKey);
      if (existingKey) {
        memoryKey = existingKey;
        return existingKey;
      }
    } catch (e) {
      console.warn('[Encryption] Failed to read from localStorage:', e);
    }
  }
  
  // 生成新密钥
  const newKey = generateRandomKey();
  memoryKey = newKey;
  
  // 保存密钥
  if (typeof localStorage !== 'undefined' && localStorage.setItem) {
    try {
      localStorage.setItem(storageKey, newKey);
    } catch (e) {
      console.warn('[Encryption] Failed to store device key:', e);
    }
  }
  
  return newKey;
};

const SALT = 'edgegenius_salt_v2'; // 更新 salt 版本
const KEY_DERIVATION_ITERATIONS = 100000;
const KEY_LENGTH = 256;

/**
 * 从密码派生加密密钥
 * @param password - 派生密钥的密码
 * @returns 加密密钥
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = encoder.encode(SALT);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: KEY_DERIVATION_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密文本
 * @param text - 需要加密的文本
 * @param password - 加密密码（可选，默认使用设备特定密钥）
 * @returns 加密后的 Base64 字符串
 */
export async function encryptText(text: string, password?: string): Promise<string> {
  if (!text) return '';

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const keyPassword = password || getEncryptionKey();
    const key = await deriveKey(keyPassword);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );

    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[Encryption] Failed to encrypt:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * 解密文本
 * @param encrypted - 加密后的 Base64 字符串
 * @param password - 解密密码（可选，默认使用设备特定密钥）
 * @returns 解密后的文本
 */
export async function decryptText(encrypted: string, password?: string): Promise<string> {
  if (!encrypted) return '';

  // 验证是否为有效的 Base64 格式
  try {
    atob(encrypted);
  } catch {
    // 不是有效的 Base64，可能是明文，直接返回
    return encrypted;
  }

  try {
    const binaryString = atob(encrypted);
    // 验证数据长度（至少要有 12 字节的 IV）
    if (binaryString.length < 12) {
      // 数据太短，可能是明文
      return encrypted;
    }

    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    const keyPassword = password || getEncryptionKey();
    const key = await deriveKey(keyPassword);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    // 静默处理解密错误，返回空字符串
    // 这通常发生在密钥变更或数据损坏时
    return '';
  }
}

/**
 * 生成安全的随机密钥
 * @returns 随机密钥字符串
 */
export function generateRandomKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 哈希文本（用于验证）
 * @param text - 需要哈希的文本
 * @returns SHA-256 哈希值
 */
export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

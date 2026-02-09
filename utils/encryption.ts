/**
 * 加密解密工具模块
 * 使用 Web Crypto API 提供安全的加密解密功能
 */

const ENCRYPTION_KEY_NAME = 'edgegenius_encryption_key';
const SALT = 'edgegenius_salt_v1';
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
 * @param password - 加密密码（默认使用固定密钥）
 * @returns 加密后的 Base64 字符串
 */
export async function encryptText(text: string, password: string = ENCRYPTION_KEY_NAME): Promise<string> {
  if (!text) return '';

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const key = await deriveKey(password);

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
 * @param password - 解密密码（默认使用固定密钥）
 * @returns 解密后的文本
 */
export async function decryptText(encrypted: string, password: string = ENCRYPTION_KEY_NAME): Promise<string> {
  if (!encrypted) return '';

  try {
    const binaryString = atob(encrypted);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    const key = await deriveKey(password);

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
    console.error('[Encryption] Failed to decrypt:', error);
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

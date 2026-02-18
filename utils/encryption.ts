/**
 * 加密解密工具模块
 * 使用 Web Crypto API 提供安全的加密解密功能
 */

const getEncryptionKey = (): string => {
  if (typeof process !== 'undefined' && process.env?.ENCRYPTION_KEY) {
    return process.env.ENCRYPTION_KEY;
  }
  return getDeviceSpecificKey();
};

let memoryKey: string | null = null;

const STORAGE_KEY = 'edgegenius_device_key';

const getDeviceSpecificKey = (): string => {
  if (memoryKey) {
    return memoryKey;
  }
  
  if (typeof localStorage !== 'undefined' && localStorage.getItem) {
    try {
      const existingKey = localStorage.getItem(STORAGE_KEY);
      if (existingKey) {
        memoryKey = existingKey;
        syncKeyToChromeStorage(existingKey);
        return existingKey;
      }
    } catch (e) {
      console.warn('[Encryption] Failed to read from localStorage:', e);
    }
  }
  
  const newKey = generateRandomKey();
  memoryKey = newKey;
  
  if (typeof localStorage !== 'undefined' && localStorage.setItem) {
    try {
      localStorage.setItem(STORAGE_KEY, newKey);
    } catch (e) {
      console.warn('[Encryption] Failed to store device key:', e);
    }
  }
  
  syncKeyToChromeStorage(newKey);
  
  return newKey;
};

const syncKeyToChromeStorage = async (key: string): Promise<void> => {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: key });
    } catch (e) {
      console.warn('[Encryption] Failed to sync key to chrome.storage:', e);
    }
  }
};

export async function getDeviceKeyForServiceWorker(): Promise<string> {
  if (memoryKey) {
    return memoryKey;
  }
  
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      if (result[STORAGE_KEY]) {
        memoryKey = result[STORAGE_KEY];
        return result[STORAGE_KEY];
      }
      
      const newKey = generateRandomKey();
      await chrome.storage.local.set({ [STORAGE_KEY]: newKey });
      memoryKey = newKey;
      return newKey;
    } catch (e) {
      console.warn('[Encryption] Failed to access chrome.storage:', e);
    }
  }
  
  return getDeviceSpecificKey();
}

export async function initEncryptionKey(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && !memoryKey) {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      if (result[STORAGE_KEY]) {
        memoryKey = result[STORAGE_KEY];
      } else {
        const newKey = generateRandomKey();
        await chrome.storage.local.set({ [STORAGE_KEY]: newKey });
        memoryKey = newKey;
      }
    } catch (e) {
      console.warn('[Encryption] Failed to initialize encryption key:', e);
    }
  }
}

const SALT = 'edgegenius_salt_v2';
const KEY_DERIVATION_ITERATIONS = 100000;
const KEY_LENGTH = 256;

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

export async function decryptText(encrypted: string, password?: string): Promise<string> {
  if (!encrypted) return '';

  try {
    atob(encrypted);
  } catch {
    return '';
  }

  try {
    const binaryString = atob(encrypted);
    if (binaryString.length < 12) {
      return '';
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
    return '';
  }
}

export function generateRandomKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const isExtensionEnv = typeof chrome !== 'undefined' && !!chrome.storage;

export function chromeStorageGet<T = unknown>(keys: string[]): Promise<Record<string, T>> {
  return new Promise((resolve) => {
    if (isExtensionEnv) {
      chrome.storage.local.get(keys, (result) => {
        resolve(result as Record<string, T>);
      });
    } else {
      const result: Record<string, T> = {};
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          try {
            result[key] = JSON.parse(value) as T;
          } catch {
            result[key] = value as unknown as T;
          }
        }
      }
      resolve(result);
    }
  });
}

export function chromeStorageSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isExtensionEnv) {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } else {
      try {
        for (const [key, value] of Object.entries(items)) {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    }
  });
}

export function chromeStorageRemove(keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isExtensionEnv) {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } else {
      try {
        for (const key of keys) {
          localStorage.removeItem(key);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    }
  });
}

export function chromeStorageSyncGet<T = unknown>(keys: string[]): Promise<Record<string, T>> {
  return new Promise((resolve) => {
    if (isExtensionEnv) {
      const storage = chrome.storage.sync || chrome.storage.local;
      storage.get(keys, (result) => {
        resolve(result as Record<string, T>);
      });
    } else {
      const result: Record<string, T> = {};
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          try {
            result[key] = JSON.parse(value) as T;
          } catch {
            result[key] = value as unknown as T;
          }
        }
      }
      resolve(result);
    }
  });
}

export function chromeStorageSyncSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isExtensionEnv) {
      const storage = chrome.storage.sync || chrome.storage.local;
      storage.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } else {
      try {
        for (const [key, value] of Object.entries(items)) {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    }
  });
}

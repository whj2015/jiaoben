import { UserScript, ScriptMetadata, Language, AIProvider, ScriptVersion } from '../types';
import { escapeHtml, validateFilename, validateScriptCode as validateCode } from '../utils/helpers';
import { encryptText, decryptText } from '../utils/encryption';

interface ChromeStorage {
  local: {
    get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
    set: (items: Record<string, unknown>, callback?: () => void) => void;
  };
  sync: {
    get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
    set: (items: Record<string, unknown>, callback?: () => void) => void;
  };
}

declare var chrome: { storage: ChromeStorage; tabs?: { query: (queryInfo: chrome.tabs.QueryInfo, callback: (tabs: chrome.tabs.Tab[]) => void) => void } };

const isExtensionEnv = typeof chrome !== 'undefined' && !!chrome.storage;

const MAX_SCRIPT_SIZE = 1024 * 1024;
const MAX_SCRIPT_NAME_LENGTH = 200;
const MAX_SCRIPT_COUNT = 500;

function validateScriptName(name: string): boolean {
  return validateFilename(name, MAX_SCRIPT_NAME_LENGTH);
}

function validateScriptCode(code: string): boolean {
  return validateCode(code, MAX_SCRIPT_SIZE).valid;
}

function sanitizeScriptCode(code: string): string {
  return code.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

export const DEFAULT_SCRIPT_TEMPLATE = `// ==UserScript==
// @name         新脚本
// @namespace    https://www.acgline.org/
// @version      0.1
// @description  尝试接管世界！
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('EdgeGenius 脚本正在运行...');
    // 在此处编写代码...
})();`;

export const parseMetadata = (code: string): ScriptMetadata => {
  const metadata: ScriptMetadata = {
    name: '无标题脚本',
    match: [],
    exclude: []
  };

  const metaBlockRegex = /\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/;
  const match = code.match(metaBlockRegex);

  if (match) {
    const content = match[1];
    const lines = content.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('// @')) return;

      const parts = trimmed.substring(4).split(/\s+/);
      const key = parts[0];
      const value = parts.slice(1).join(' ');

      if (key === 'name') metadata.name = escapeHtml(value);
      else if (key === 'namespace') metadata.namespace = value;
      else if (key === 'version') metadata.version = escapeHtml(value);
      else if (key === 'description') metadata.description = escapeHtml(value);
      else if (key === 'author') metadata.author = value;
      else if (key === 'match') metadata.match.push(escapeHtml(value));
      else if (key === 'exclude') metadata.exclude.push(escapeHtml(value));
      else if (key === 'run-at') metadata.runAt = value;
    });
  }

  return metadata;
};

export const getScripts = async (): Promise<UserScript[]> => {
  try {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['user_scripts'], (result: Record<string, unknown>) => {
          resolve((result.user_scripts as UserScript[]) || []);
        });
      });
    } else {
      const stored = localStorage.getItem('user_scripts');
      return stored ? JSON.parse(stored) as UserScript[] : [];
    }
  } catch (error) {
    console.error('[ScriptService] Failed to get scripts:', error);
    return [];
  }
};

export const saveScript = async (script: UserScript): Promise<void> => {
  if (!validateScriptName(script.name)) {
    throw new Error('Invalid script name');
  }
  
  if (!validateScriptCode(script.code)) {
    throw new Error('Invalid script code or size exceeds limit');
  }

  const sanitizedCode = sanitizeScriptCode(script.code);
  script.code = sanitizedCode;

  const scripts = await getScripts();
  
  if (scripts.length >= MAX_SCRIPT_COUNT && !scripts.find(s => s.id === script.id)) {
    throw new Error('Maximum number of scripts reached');
  }
  
  const index = scripts.findIndex(s => s.id === script.id);
  
  if (index >= 0) {
    const oldScript = scripts[index];
    
    if (oldScript.code !== script.code) {
      const archiveTimestamp = oldScript.updatedAt || Date.now();
      
      const historyEntry: ScriptVersion = {
        timestamp: archiveTimestamp,
        code: oldScript.code,
        version: oldScript.version
      };
      
      const existingHistory = oldScript.history || [];
      script.history = [historyEntry, ...existingHistory].slice(0, 30);
    } else {
      script.history = oldScript.history || [];
    }

    scripts[index] = script;
  } else {
    script.history = [];
    scripts.push(script);
  }

  try {
    if (isExtensionEnv) {
      await chrome.storage.local.set({ user_scripts: scripts });
    } else {
      localStorage.setItem('user_scripts', JSON.stringify(scripts));
    }
  } catch (error) {
    console.error('[ScriptService] Failed to save script:', error);
    throw new Error('Failed to save script');
  }
};

export const deleteScript = async (id: string): Promise<void> => {
  try {
    let scripts = await getScripts();
    scripts = scripts.filter(s => s.id !== id);

    if (isExtensionEnv) {
      await chrome.storage.local.set({ user_scripts: scripts });
    } else {
      localStorage.setItem('user_scripts', JSON.stringify(scripts));
    }
  } catch (error) {
    console.error('[ScriptService] Failed to delete script:', error);
    throw new Error('Failed to delete script');
  }
};

export const toggleScript = async (id: string, enabled: boolean): Promise<void> => {
  try {
    const scripts = await getScripts();
    const script = scripts.find(s => s.id === id);
    if (script) {
      script.enabled = enabled;
      const index = scripts.findIndex(s => s.id === id);
      if (index >= 0) {
        scripts[index] = script;
        if (isExtensionEnv) {
          await chrome.storage.local.set({ user_scripts: scripts });
        } else {
          localStorage.setItem('user_scripts', JSON.stringify(scripts));
        }
      }
    }
  } catch (error) {
    console.error('[ScriptService] Failed to toggle script:', error);
    throw new Error('Failed to toggle script');
  }
};

export const clearScriptHistory = async (id: string): Promise<void> => {
  try {
    const scripts = await getScripts();
    const script = scripts.find(s => s.id === id);
    
    if (script) {
      script.history = [];
      const index = scripts.findIndex(s => s.id === id);
      if (index >= 0) {
        scripts[index] = script;
        if (isExtensionEnv) {
          await chrome.storage.local.set({ user_scripts: scripts });
        } else {
          localStorage.setItem('user_scripts', JSON.stringify(scripts));
        }
      }
    }
  } catch (error) {
    console.error('[ScriptService] Failed to clear history:', error);
    throw new Error('Failed to clear history');
  }
};

export const deleteScriptVersion = async (scriptId: string, timestamp: number): Promise<void> => {
  try {
    const scripts = await getScripts();
    const script = scripts.find(s => s.id === scriptId);
    
    if (script && script.history) {
      script.history = script.history.filter(v => v.timestamp !== timestamp);
      const index = scripts.findIndex(s => s.id === scriptId);
      if (index >= 0) {
        scripts[index] = script;
        if (isExtensionEnv) {
          await chrome.storage.local.set({ user_scripts: scripts });
        } else {
          localStorage.setItem('user_scripts', JSON.stringify(scripts));
        }
      }
    }
  } catch (error) {
    console.error('[ScriptService] Failed to delete version:', error);
    throw new Error('Failed to delete version');
  }
};

export const createScriptFromCode = (code: string, id?: string): UserScript => {
  const meta = parseMetadata(code);
  return {
    id: id || Date.now().toString() + Math.random().toString(36).substring(2, 9),
    name: meta.name || '无标题脚本',
    description: meta.description || '',
    version: meta.version || '0.1',
    match: meta.match.length > 0 ? meta.match : ['*://*/*'],
    exclude: meta.exclude,
    code: code,
    enabled: true,
    runAt: (meta.runAt as any) || 'document-idle',
    updatedAt: Date.now(),
    history: []
  };
};

export const exportScriptFile = (script: UserScript) => {
  try {
    const blob = new Blob([script.code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.name.replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '')}.user.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('[ScriptService] Failed to export script:', error);
    throw new Error('Failed to export script');
  }
};

export const exportBackup = async () => {
  try {
    const scripts = await getScripts();
    const backupData = {
      timestamp: Date.now(),
      version: '1.0',
      scripts: scripts
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EdgeGenius_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('[ScriptService] Failed to export backup:', error);
    throw new Error('Failed to export backup');
  }
};

export const importScripts = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    
    if (file.size > MAX_SCRIPT_SIZE * 10) {
      reject(new Error('File too large'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        if (!content || typeof content !== 'string') {
          reject(new Error('Invalid file content'));
          return;
        }
        
        let count = 0;

        if (file.name.endsWith('.json')) {
          const data = JSON.parse(content);
          const scriptsToImport: UserScript[] = Array.isArray(data) ? data : (data.scripts || []);
          
          if (scriptsToImport.length > MAX_SCRIPT_COUNT) {
            reject(new Error(`Too many scripts (max ${MAX_SCRIPT_COUNT})`));
            return;
          }
          
          for (const s of scriptsToImport) {
            if (!s.id) s.id = Date.now().toString() + Math.random().toString().slice(2, 6);
            s.updatedAt = Date.now();
            await saveScript(s);
            count++;
          }
        } else {
          const script = createScriptFromCode(content);
          await saveScript(script);
          count = 1;
        }
        resolve(count);
      } catch (err) {
        console.error('[ScriptService] Import failed:', err);
        reject(err instanceof Error ? err : new Error('Import failed'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

export const getStoredApiKey = async (): Promise<string> => {
    try {
      if (isExtensionEnv) {
        return new Promise((resolve) => {
          const storage = chrome.storage.sync || chrome.storage.local;
          storage.get(['gemini_api_key'], async (result: Record<string, unknown>) => {
            const encrypted = (result.gemini_api_key as string) || '';
            if (encrypted) {
              const decrypted = await decryptText(encrypted);
              resolve(decrypted);
            } else {
              resolve('');
            }
          });
        });
      } else {
        const encrypted = localStorage.getItem('gemini_api_key') || '';
        if (encrypted) {
          return await decryptText(encrypted);
        }
        return '';
      }
    } catch (error) {
      console.error('[ScriptService] Failed to get API key:', error);
      return '';
    }
};
  
export const setStoredApiKey = async (apiKey: string): Promise<void> => {
  try {
    const encrypted = await encryptText(apiKey);
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        const storage = chrome.storage.sync || chrome.storage.local;
        storage.set({ gemini_api_key: encrypted }, resolve);
      });
    } else {
      localStorage.setItem('gemini_api_key', encrypted);
      return Promise.resolve();
    }
  } catch (error) {
    console.error('[ScriptService] Failed to set API key:', error);
    throw new Error('Failed to save API key');
  }
};

export const getStoredDeepSeekKey = async (): Promise<string> => {
  try {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        const storage = chrome.storage.sync || chrome.storage.local;
        storage.get(['deepseek_api_key'], async (result: Record<string, unknown>) => {
          const encrypted = (result.deepseek_api_key as string) || '';
          if (encrypted) {
            const decrypted = await decryptText(encrypted);
            resolve(decrypted);
          } else {
            resolve('');
          }
        });
      });
    } else {
      const encrypted = localStorage.getItem('deepseek_api_key') || '';
      if (encrypted) {
        return await decryptText(encrypted);
      }
      return '';
    }
  } catch (error) {
    console.error('[ScriptService] Failed to get DeepSeek key:', error);
    return '';
  }
};

export const setStoredDeepSeekKey = async (apiKey: string): Promise<void> => {
  try {
    const encrypted = await encryptText(apiKey);
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        const storage = chrome.storage.sync || chrome.storage.local;
        storage.set({ deepseek_api_key: encrypted }, resolve);
      });
    } else {
      localStorage.setItem('deepseek_api_key', encrypted);
      return Promise.resolve();
    }
  } catch (error) {
    console.error('[ScriptService] Failed to set DeepSeek key:', error);
    throw new Error('Failed to save DeepSeek key');
  }
};

export const getStoredAIProvider = async (): Promise<AIProvider> => {
  try {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['ai_provider'], (result: Record<string, unknown>) => {
          resolve((result.ai_provider as AIProvider) || AIProvider.GOOGLE);
        });
      });
    } else {
      return (localStorage.getItem('ai_provider') as AIProvider) || AIProvider.GOOGLE;
    }
  } catch (error) {
    console.error('[ScriptService] Failed to get AI provider:', error);
    return AIProvider.GOOGLE;
  }
};

export const setStoredAIProvider = async (provider: AIProvider): Promise<void> => {
  try {
    if (isExtensionEnv) {
      await chrome.storage.local.set({ ai_provider: provider });
    } else {
      localStorage.setItem('ai_provider', provider);
    }
  } catch (error) {
    console.error('[ScriptService] Failed to set AI provider:', error);
    throw new Error('Failed to save AI provider');
  }
};

export const getStoredLanguage = async (): Promise<Language> => {
  try {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['app_language'], (result: Record<string, unknown>) => {
          resolve((result.app_language as Language) || Language.ZH_CN);
        });
      });
    } else {
      return (localStorage.getItem('app_language') as Language) || Language.ZH_CN;
    }
  } catch (error) {
    console.error('[ScriptService] Failed to get language:', error);
    return Language.ZH_CN;
  }
};

export const setStoredLanguage = async (lang: Language): Promise<void> => {
  try {
    if (isExtensionEnv) {
      await chrome.storage.local.set({ app_language: lang });
    } else {
      localStorage.setItem('app_language', lang);
    }
  } catch (error) {
    console.error('[ScriptService] Failed to set language:', error);
    throw new Error('Failed to save language');
  }
};

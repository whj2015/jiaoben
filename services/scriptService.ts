import { UserScript, ScriptMetadata, Language, AIProvider, ScriptVersion } from '../types';

declare var chrome: any;

const isExtensionEnv = typeof chrome !== 'undefined' && !!chrome.storage;

// 默认脚本模板
export const DEFAULT_SCRIPT_TEMPLATE = `// ==UserScript==
// @name         New Script
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('EdgeGenius Script Running...');
    // Your code here...
})();`;

/**
 * 解析用户脚本元数据
 */
export const parseMetadata = (code: string): ScriptMetadata => {
  const metadata: ScriptMetadata = {
    name: 'Untitled Script',
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

      if (key === 'name') metadata.name = value;
      else if (key === 'version') metadata.version = value;
      else if (key === 'description') metadata.description = value;
      else if (key === 'match') metadata.match.push(value);
      else if (key === 'exclude') metadata.exclude.push(value);
      else if (key === 'run-at') metadata.runAt = value;
    });
  }

  return metadata;
};

/**
 * 获取所有脚本
 */
export const getScripts = async (): Promise<UserScript[]> => {
  if (isExtensionEnv) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['user_scripts'], (result: any) => {
        resolve(result.user_scripts || []);
      });
    });
  } else {
    const stored = localStorage.getItem('user_scripts');
    return stored ? JSON.parse(stored) : [];
  }
};

/**
 * 保存脚本 (新增或更新)
 */
export const saveScript = async (script: UserScript): Promise<void> => {
  const scripts = await getScripts();
  const index = scripts.findIndex(s => s.id === script.id);
  
  if (index >= 0) {
    // 更新现有脚本
    const oldScript = scripts[index];
    
    // 如果代码发生变化，保存历史版本
    if (oldScript.code !== script.code) {
      const archiveTimestamp = oldScript.updatedAt || Date.now();
      
      const historyEntry: ScriptVersion = {
        timestamp: archiveTimestamp,
        code: oldScript.code,
        version: oldScript.version
      };
      
      // 合并历史记录，限制最大数量 (例如 30 条)
      const existingHistory = oldScript.history || [];
      script.history = [historyEntry, ...existingHistory].slice(0, 30);
    } else {
      // 代码未变，保留原有历史
      script.history = oldScript.history || [];
    }

    scripts[index] = script;
  } else {
    // 新增脚本
    script.history = [];
    scripts.push(script);
  }

  if (isExtensionEnv) {
    await chrome.storage.local.set({ user_scripts: scripts });
  } else {
    localStorage.setItem('user_scripts', JSON.stringify(scripts));
  }
};

/**
 * 删除脚本
 */
export const deleteScript = async (id: string): Promise<void> => {
  let scripts = await getScripts();
  scripts = scripts.filter(s => s.id !== id);

  if (isExtensionEnv) {
    await chrome.storage.local.set({ user_scripts: scripts });
  } else {
    localStorage.setItem('user_scripts', JSON.stringify(scripts));
  }
};

/**
 * 切换脚本启用状态
 */
export const toggleScript = async (id: string, enabled: boolean): Promise<void> => {
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
};

/**
 * 清除特定脚本的历史记录
 */
export const clearScriptHistory = async (id: string): Promise<void> => {
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
};

/**
 * 删除特定历史版本
 */
export const deleteScriptVersion = async (scriptId: string, timestamp: number): Promise<void> => {
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
};

/**
 * 从代码生成 UserScript 对象
 */
export const createScriptFromCode = (code: string, id?: string): UserScript => {
  const meta = parseMetadata(code);
  return {
    id: id || Date.now().toString(),
    name: meta.name || 'Imported Script',
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

// --- Import / Export Functions ---

export const exportScriptFile = (script: UserScript) => {
  const blob = new Blob([script.code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${script.name.replace(/\s+/g, '_')}.user.js`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportBackup = async () => {
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
  URL.revokeObjectURL(url);
};

export const importScripts = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        let count = 0;

        if (file.name.endsWith('.json')) {
          // Backup Import
          const data = JSON.parse(content);
          const scriptsToImport: UserScript[] = Array.isArray(data) ? data : (data.scripts || []);
          
          for (const s of scriptsToImport) {
            // Ensure ID exists
            if (!s.id) s.id = Date.now().toString() + Math.random().toString().slice(2, 6);
            s.updatedAt = Date.now();
            await saveScript(s);
            count++;
          }
        } else {
          // Single JS File Import
          const script = createScriptFromCode(content);
          await saveScript(script);
          count = 1;
        }
        resolve(count);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// --- Storage Helpers ---

export const getStoredApiKey = async (): Promise<string> => {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        const storage = chrome.storage.sync || chrome.storage.local;
        storage.get(['gemini_api_key'], (result: any) => {
          resolve(result.gemini_api_key || '');
        });
      });
    } else {
      return localStorage.getItem('gemini_api_key') || '';
    }
};
  
export const setStoredApiKey = async (apiKey: string): Promise<void> => {
  if (isExtensionEnv) {
    return new Promise((resolve) => {
      const storage = chrome.storage.sync || chrome.storage.local;
      storage.set({ gemini_api_key: apiKey }, resolve);
    });
  } else {
    localStorage.setItem('gemini_api_key', apiKey);
    return Promise.resolve();
  }
};

export const getStoredDeepSeekKey = async (): Promise<string> => {
  if (isExtensionEnv) {
    return new Promise((resolve) => {
      const storage = chrome.storage.sync || chrome.storage.local;
      storage.get(['deepseek_api_key'], (result: any) => {
        resolve(result.deepseek_api_key || '');
      });
    });
  } else {
    return localStorage.getItem('deepseek_api_key') || '';
  }
};

export const setStoredDeepSeekKey = async (apiKey: string): Promise<void> => {
  if (isExtensionEnv) {
    return new Promise((resolve) => {
      const storage = chrome.storage.sync || chrome.storage.local;
      storage.set({ deepseek_api_key: apiKey }, resolve);
    });
  } else {
    localStorage.setItem('deepseek_api_key', apiKey);
    return Promise.resolve();
  }
};

export const getStoredAIProvider = async (): Promise<AIProvider> => {
  if (isExtensionEnv) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['ai_provider'], (result: any) => {
        resolve((result.ai_provider as AIProvider) || AIProvider.GOOGLE);
      });
    });
  } else {
    return (localStorage.getItem('ai_provider') as AIProvider) || AIProvider.GOOGLE;
  }
};

export const setStoredAIProvider = async (provider: AIProvider): Promise<void> => {
  if (isExtensionEnv) {
    await chrome.storage.local.set({ ai_provider: provider });
  } else {
    localStorage.setItem('ai_provider', provider);
  }
};

export const getStoredLanguage = async (): Promise<Language> => {
  if (isExtensionEnv) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['app_language'], (result: any) => {
        resolve((result.app_language as Language) || Language.ZH_CN);
      });
    });
  } else {
    return (localStorage.getItem('app_language') as Language) || Language.ZH_CN;
  }
};

export const setStoredLanguage = async (lang: Language): Promise<void> => {
  if (isExtensionEnv) {
    await chrome.storage.local.set({ app_language: lang });
  } else {
    localStorage.setItem('app_language', lang);
  }
};
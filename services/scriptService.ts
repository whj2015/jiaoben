import { UserScript, ScriptVersion, Language, AIProvider } from '../types';
import { parseMetadata } from '../utils/metadataParser';

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

// --- Helpers ---
const fetchDependency = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}: ${response.statusText}`);
    return await response.text();
  } catch (e) {
    console.error(`Dependency load error: ${url}`, e);
    return `// Failed to load dependency: ${url}\n// Error: ${String(e)}`;
  }
};

// --- CRUD ---

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

export const saveScript = async (script: UserScript): Promise<void> => {
  // 1. Parse Metadata
  script.metadata = parseMetadata(script.code);
  
  // 2. Sync top-level fields for easy access
  script.name = script.metadata.name;
  script.description = script.metadata.description || '';
  script.version = script.metadata.version || '0.1';
  script.match = script.metadata.match;
  script.exclude = script.metadata.exclude;
  script.runAt = script.metadata.runAt;

  // 3. Handle @require dependencies
  if (script.metadata.require && script.metadata.require.length > 0) {
    script.requiresContent = script.requiresContent || {};
    const newRequires: Record<string, string> = {};
    
    for (const url of script.metadata.require) {
      if (script.requiresContent[url]) {
        // Use cached if available
        newRequires[url] = script.requiresContent[url];
      } else {
        // Fetch new
        newRequires[url] = await fetchDependency(url);
      }
    }
    script.requiresContent = newRequires;
  }

  // 4. Archive History
  const scripts = await getScripts();
  const index = scripts.findIndex(s => s.id === script.id);
  
  if (index >= 0) {
    const oldScript = scripts[index];
    if (oldScript.code !== script.code) {
      const historyEntry: ScriptVersion = {
        timestamp: oldScript.updatedAt || Date.now(),
        code: oldScript.code,
        version: oldScript.version || '0.0'
      };
      const existingHistory = oldScript.history || [];
      script.history = [historyEntry, ...existingHistory].slice(0, 30);
      
      // Preserve storage data
      script.storage = oldScript.storage || {};
    } else {
      script.history = oldScript.history || [];
      script.storage = oldScript.storage || {};
    }
    script.updatedAt = Date.now();
    scripts[index] = script;
  } else {
    script.history = [];
    script.storage = {};
    script.updatedAt = Date.now();
    scripts.push(script);
  }

  // 5. Save to Storage
  if (isExtensionEnv) {
    await chrome.storage.local.set({ user_scripts: scripts });
  } else {
    localStorage.setItem('user_scripts', JSON.stringify(scripts));
  }
};

export const deleteScript = async (id: string): Promise<void> => {
  let scripts = await getScripts();
  scripts = scripts.filter(s => s.id !== id);

  if (isExtensionEnv) {
    await chrome.storage.local.set({ user_scripts: scripts });
  } else {
    localStorage.setItem('user_scripts', JSON.stringify(scripts));
  }
};

export const toggleScript = async (id: string, enabled: boolean): Promise<void> => {
  const scripts = await getScripts();
  const index = scripts.findIndex(s => s.id === id);
  if (index >= 0) {
    scripts[index].enabled = enabled;
    if (isExtensionEnv) {
      await chrome.storage.local.set({ user_scripts: scripts });
    } else {
      localStorage.setItem('user_scripts', JSON.stringify(scripts));
    }
  }
};

export const createScriptFromCode = (code: string, id?: string): UserScript => {
  const meta = parseMetadata(code);
  return {
    id: id || Date.now().toString(),
    metadata: meta,
    name: meta.name,
    description: meta.description || '',
    version: meta.version || '0.1',
    match: meta.match,
    exclude: meta.exclude,
    code: code,
    enabled: true,
    runAt: meta.runAt,
    updatedAt: Date.now(),
    history: [],
    storage: {}
  };
};

// --- History & Other Helpers ---

export const clearScriptHistory = async (id: string): Promise<void> => {
  const scripts = await getScripts();
  const script = scripts.find(s => s.id === id);
  if (script) {
    script.history = [];
    await saveToStorage(scripts);
  }
};

export const deleteScriptVersion = async (scriptId: string, timestamp: number): Promise<void> => {
  const scripts = await getScripts();
  const script = scripts.find(s => s.id === scriptId);
  if (script && script.history) {
    script.history = script.history.filter(v => v.timestamp !== timestamp);
    await saveToStorage(scripts);
  }
};

const saveToStorage = async (scripts: UserScript[]) => {
  if (isExtensionEnv) {
    await chrome.storage.local.set({ user_scripts: scripts });
  } else {
    localStorage.setItem('user_scripts', JSON.stringify(scripts));
  }
};

// --- Import/Export ---

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
    app: "EdgeGenius",
    version: '3.0',
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
          const data = JSON.parse(content);
          const scriptsToImport: UserScript[] = Array.isArray(data) ? data : (data.scripts || []);
          for (const s of scriptsToImport) {
            // Re-validate and fix structure if needed
            if (!s.metadata) s.metadata = parseMetadata(s.code);
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
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// --- Settings Storage ---

export const getStoredApiKey = async (): Promise<string> => {
    if (isExtensionEnv) return (await chrome.storage.sync.get(['gemini_api_key'])).gemini_api_key || '';
    return localStorage.getItem('gemini_api_key') || '';
};
export const setStoredApiKey = async (key: string): Promise<void> => {
  if (isExtensionEnv) await chrome.storage.sync.set({ gemini_api_key: key });
  else localStorage.setItem('gemini_api_key', key);
};

export const getStoredDeepSeekKey = async (): Promise<string> => {
  if (isExtensionEnv) return (await chrome.storage.sync.get(['deepseek_api_key'])).deepseek_api_key || '';
  return localStorage.getItem('deepseek_api_key') || '';
};
export const setStoredDeepSeekKey = async (key: string): Promise<void> => {
  if (isExtensionEnv) await chrome.storage.sync.set({ deepseek_api_key: key });
  else localStorage.setItem('deepseek_api_key', key);
};

export const getStoredAIProvider = async (): Promise<AIProvider> => {
  if (isExtensionEnv) return (await chrome.storage.local.get(['ai_provider'])).ai_provider || AIProvider.GOOGLE;
  return (localStorage.getItem('ai_provider') as AIProvider) || AIProvider.GOOGLE;
};
export const setStoredAIProvider = async (p: AIProvider): Promise<void> => {
  if (isExtensionEnv) await chrome.storage.local.set({ ai_provider: p });
  else localStorage.setItem('ai_provider', p);
};

export const getStoredLanguage = async (): Promise<Language> => {
  if (isExtensionEnv) return (await chrome.storage.local.get(['app_language'])).app_language || Language.ZH_CN;
  return (localStorage.getItem('app_language') as Language) || Language.ZH_CN;
};
export const setStoredLanguage = async (l: Language): Promise<void> => {
  if (isExtensionEnv) await chrome.storage.local.set({ app_language: l });
  else localStorage.setItem('app_language', l);
};

import { UserScript, Language, AIProvider, ScriptVersion, CustomAIConfig } from '../types';
import { validateFilename, validateScriptCode as validateCode } from '../utils/helpers';
import { encryptText, decryptText } from '../utils/encryption';
import { parseScriptMetadata } from '../utils/metadata';
import { 
  chromeStorageGet, 
  chromeStorageSet, 
  chromeStorageSyncGet, 
  chromeStorageSyncSet 
} from '../utils/chromeApi';
import { DEFAULT_SCRIPT_TEMPLATE as CONFIG_DEFAULT_TEMPLATE, APP_CONFIG } from '../config/appConfig';

const MAX_SCRIPT_SIZE = APP_CONFIG.SCRIPT.MAX_SIZE;
const MAX_SCRIPT_NAME_LENGTH = APP_CONFIG.SCRIPT.MAX_NAME_LENGTH;
const MAX_SCRIPT_COUNT = APP_CONFIG.SCRIPT.MAX_COUNT;

export const DEFAULT_SCRIPT_TEMPLATE = CONFIG_DEFAULT_TEMPLATE;

function validateScriptName(name: string): boolean {
  return validateFilename(name, MAX_SCRIPT_NAME_LENGTH);
}

function validateScriptCode(code: string): boolean {
  return validateCode(code, MAX_SCRIPT_SIZE).valid;
}

function sanitizeScriptCode(code: string): string {
  return code.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

export const parseMetadata = parseScriptMetadata;

export const getScripts = async (): Promise<UserScript[]> => {
  try {
    const result = await chromeStorageGet<UserScript[]>(['user_scripts']);
    return result.user_scripts || [];
  } catch (error) {
    console.error('[ScriptService] Failed to get scripts:', error);
    return [];
  }
};

export const saveScript = async (script: UserScript, skipAutoSync: boolean = false): Promise<void> => {
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
    await chromeStorageSet({ user_scripts: scripts });
  } catch (error) {
    console.error('[ScriptService] Failed to save script:', error);
    throw new Error('Failed to save script');
  }

  if (!skipAutoSync) {
    autoSyncScriptToGitHub(script).catch(err => {
      console.warn('[ScriptService] Auto sync to GitHub failed:', err);
    });
  }
};

const autoSyncScriptToGitHub = async (script: UserScript): Promise<void> => {
  try {
    const autoSyncEnabled = await getAutoSyncToGitHub();
    if (!autoSyncEnabled) {
      return;
    }

    const { isGitHubAuthenticated } = await import('./githubAuth');
    const isAuthenticated = await isGitHubAuthenticated();
    if (!isAuthenticated) {
      console.log('[ScriptService] GitHub not authenticated, skipping auto sync');
      return;
    }

    const { ensureRepoExists, uploadSingleScript } = await import('./githubRepo');
    await ensureRepoExists();
    
    const result = await uploadSingleScript({ name: script.name, code: script.code });
    if (result.success) {
      console.log(`[ScriptService] Auto synced script '${script.name}' to GitHub`);
    } else {
      console.warn(`[ScriptService] Failed to auto sync script '${script.name}':`, result.error);
    }
  } catch (error) {
    console.warn('[ScriptService] Auto sync to GitHub failed:', error);
  }
};

export const deleteScript = async (id: string): Promise<void> => {
  try {
    let scripts = await getScripts();
    scripts = scripts.filter(s => s.id !== id);
    await chromeStorageSet({ user_scripts: scripts });
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
        await chromeStorageSet({ user_scripts: scripts });
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
        await chromeStorageSet({ user_scripts: scripts });
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
        await chromeStorageSet({ user_scripts: scripts });
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
    runAt: (meta.runAt as UserScript['runAt']) || 'document-idle',
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
            await saveScript(s, true);
            count++;
          }
          
          if (count > 0) {
            autoSyncAllScriptsToGitHub().catch(err => {
              console.warn('[ScriptService] Auto sync all scripts to GitHub failed:', err);
            });
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

const autoSyncAllScriptsToGitHub = async (): Promise<void> => {
  try {
    const autoSyncEnabled = await getAutoSyncToGitHub();
    if (!autoSyncEnabled) {
      return;
    }

    const { isGitHubAuthenticated } = await import('./githubAuth');
    const isAuthenticated = await isGitHubAuthenticated();
    if (!isAuthenticated) {
      console.log('[ScriptService] GitHub not authenticated, skipping auto sync');
      return;
    }

    const { uploadAllScripts, ensureRepoExists } = await import('./githubRepo');
    await ensureRepoExists();
    
    const result = await uploadAllScripts();
    if (result.uploaded > 0) {
      console.log(`[ScriptService] Auto synced ${result.uploaded} scripts to GitHub`);
    }
    if (result.errors.length > 0) {
      console.warn('[ScriptService] Some scripts failed to sync:', result.errors);
    }
  } catch (error) {
    console.warn('[ScriptService] Auto sync all scripts to GitHub failed:', error);
  }
};

export const getStoredApiKey = async (): Promise<string> => {
  try {
    const result = await chromeStorageSyncGet<string>(['gemini_api_key']);
    const encrypted = result.gemini_api_key || '';
    if (encrypted) {
      return await decryptText(encrypted);
    }
    return '';
  } catch (error) {
    console.error('[ScriptService] Failed to get API key:', error);
    return '';
  }
};
  
export const setStoredApiKey = async (apiKey: string): Promise<void> => {
  try {
    const encrypted = await encryptText(apiKey);
    await chromeStorageSyncSet({ gemini_api_key: encrypted });
  } catch (error) {
    console.error('[ScriptService] Failed to set API key:', error);
    throw new Error('Failed to save API key');
  }
};

export const getStoredDeepSeekKey = async (): Promise<string> => {
  try {
    const result = await chromeStorageSyncGet<string>(['deepseek_api_key']);
    const encrypted = result.deepseek_api_key || '';
    if (encrypted) {
      return await decryptText(encrypted);
    }
    return '';
  } catch (error) {
    console.error('[ScriptService] Failed to get DeepSeek key:', error);
    return '';
  }
};

export const setStoredDeepSeekKey = async (apiKey: string): Promise<void> => {
  try {
    const encrypted = await encryptText(apiKey);
    await chromeStorageSyncSet({ deepseek_api_key: encrypted });
  } catch (error) {
    console.error('[ScriptService] Failed to set DeepSeek key:', error);
    throw new Error('Failed to save DeepSeek key');
  }
};

export const getStoredAIProvider = async (): Promise<AIProvider> => {
  try {
    const result = await chromeStorageGet<AIProvider>(['ai_provider']);
    return result.ai_provider || AIProvider.GOOGLE;
  } catch (error) {
    console.error('[ScriptService] Failed to get AI provider:', error);
    return AIProvider.GOOGLE;
  }
};

export const setStoredAIProvider = async (provider: AIProvider): Promise<void> => {
  try {
    await chromeStorageSet({ ai_provider: provider });
  } catch (error) {
    console.error('[ScriptService] Failed to set AI provider:', error);
    throw new Error('Failed to save AI provider');
  }
};

export const getStoredLanguage = async (): Promise<Language> => {
  try {
    const result = await chromeStorageGet<Language>(['app_language']);
    return result.app_language || Language.ZH_CN;
  } catch (error) {
    console.error('[ScriptService] Failed to get language:', error);
    return Language.ZH_CN;
  }
};

export const setStoredLanguage = async (lang: Language): Promise<void> => {
  try {
    await chromeStorageSet({ app_language: lang });
  } catch (error) {
    console.error('[ScriptService] Failed to set language:', error);
    throw new Error('Failed to save language');
  }
};

export const getAutoSyncToGitHub = async (): Promise<boolean> => {
  try {
    const result = await chromeStorageGet<boolean>(['auto_sync_github']);
    const stored = result.auto_sync_github;
    if (stored === undefined || stored === null) {
      return true;
    }
    return stored;
  } catch (error) {
    console.error('[ScriptService] Failed to get auto sync setting:', error);
    return true;
  }
};

export const setAutoSyncToGitHub = async (enabled: boolean): Promise<void> => {
  try {
    await chromeStorageSet({ auto_sync_github: enabled });
  } catch (error) {
    console.error('[ScriptService] Failed to set auto sync setting:', error);
    throw new Error('Failed to save auto sync setting');
  }
};

export const getStoredCustomAIConfig = async (): Promise<CustomAIConfig> => {
  try {
    const result = await chromeStorageSyncGet<CustomAIConfig>(['custom_ai_config']);
    const config = result.custom_ai_config || { apiUrl: '', apiKey: '', model: '' };
    if (config.apiKey) {
      config.apiKey = await decryptText(config.apiKey);
    }
    return config;
  } catch (error) {
    console.error('[ScriptService] Failed to get custom AI config:', error);
    return { apiUrl: '', apiKey: '', model: '' };
  }
};

export const setStoredCustomAIConfig = async (config: CustomAIConfig): Promise<void> => {
  try {
    const encryptedConfig = {
      ...config,
      apiKey: config.apiKey ? await encryptText(config.apiKey) : ''
    };
    await chromeStorageSyncSet({ custom_ai_config: encryptedConfig });
  } catch (error) {
    console.error('[ScriptService] Failed to set custom AI config:', error);
    throw new Error('Failed to save custom AI config');
  }
};

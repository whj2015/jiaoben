import { UserScript, GitHubContent } from '../types';
import { saveScript } from './scriptService';
import { validateScriptCode, generateUniqueId } from '../utils/helpers';
import { parseScriptMetadata, hasValidMetadata, extractScriptName } from '../utils/metadata';

const MAX_SCRIPT_SIZE = 1024 * 1024;
const VALID_SCRIPT_EXTENSIONS = ['.js', '.ts', '.mjs'];

export const validateScriptFormat = (
  code: string,
  filename?: string
): { valid: boolean; error?: string } => {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: '脚本内容不能为空' };
  }

  if (code.length > MAX_SCRIPT_SIZE) {
    return { valid: false, error: `脚本大小超过限制 (最大 ${MAX_SCRIPT_SIZE / 1024 / 1024}MB)` };
  }

  if (!hasValidMetadata(code)) {
    return { valid: false, error: '缺少有效的 UserScript 头部 (// ==UserScript== ... // ==/UserScript==)' };
  }

  if (filename) {
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (!VALID_SCRIPT_EXTENSIONS.includes(extension)) {
      return { valid: false, error: `不支持的文件扩展名: ${extension}。支持的扩展名: ${VALID_SCRIPT_EXTENSIONS.join(', ')}` };
    }
  }

  const codeValidation = validateScriptCode(code, MAX_SCRIPT_SIZE);
  if (!codeValidation.valid) {
    return { valid: false, error: codeValidation.error };
  }

  return { valid: true };
};

export const importScriptToLocal = async (
  code: string,
  filename?: string,
  skipAutoSync: boolean = false
): Promise<UserScript> => {
  if (!code || typeof code !== 'string') {
    throw new Error('脚本内容不能为空');
  }

  const validation = validateScriptFormat(code, filename);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const metadata = parseScriptMetadata(code);

  const scripts = await (await import('./scriptService')).getScripts();
  
  const existingScript = scripts.find(s => s.name === metadata.name);
  
  const script: UserScript = {
    id: existingScript?.id || generateUniqueId(),
    name: metadata.name || '无标题脚本',
    description: metadata.description || existingScript?.description || '',
    version: metadata.version || existingScript?.version || '0.1',
    match: metadata.match.length > 0 ? metadata.match : existingScript?.match || ['*://*/*'],
    exclude: metadata.exclude.length > 0 ? metadata.exclude : existingScript?.exclude || [],
    code: code,
    enabled: existingScript?.enabled ?? true,
    runAt: normalizeRunAt(metadata.runAt) || existingScript?.runAt || 'document-idle',
    updatedAt: Date.now(),
    history: existingScript?.history || []
  };

  await (await import('./scriptService')).saveScript(script, skipAutoSync);

  return script;
};

const normalizeRunAt = (
  runAt?: string
): 'document-start' | 'document-end' | 'document-idle' => {
  const validRunAtValues = ['document-start', 'document-end', 'document-idle'] as const;
  
  if (runAt && validRunAtValues.includes(runAt as typeof validRunAtValues[number])) {
    return runAt as typeof validRunAtValues[number];
  }
  
  return 'document-idle';
};

export const decodeGitHubContent = (content: string, encoding?: string): string => {
  if (!content) {
    return '';
  }

  if (encoding === 'base64') {
    try {
      const decoded = atob(content);
      return decoded;
    } catch (error) {
      console.error('[ScriptImport] Failed to decode base64 content:', error);
      return '';
    }
  }

  return content;
};

export const importScriptsFromGitHub = async (
  contents: GitHubContent[]
): Promise<{ imported: number; skipped: number; errors: string[] }> => {
  const result = {
    imported: 0,
    skipped: 0,
    errors: [] as string[]
  };

  const scriptFiles = contents.filter(content => {
    if (content.type !== 'file') {
      return false;
    }

    const extension = content.name.toLowerCase().substring(content.name.lastIndexOf('.'));
    return VALID_SCRIPT_EXTENSIONS.includes(extension);
  });

  for (const file of scriptFiles) {
    try {
      let code: string;

      if (file.content && file.encoding) {
        code = decodeGitHubContent(file.content, file.encoding);
      } else if (file.download_url) {
        const response = await fetch(file.download_url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        code = await response.text();
      } else {
        result.skipped++;
        result.errors.push(`${file.name}: 无法获取文件内容`);
        continue;
      }

      if (!code) {
        result.skipped++;
        result.errors.push(`${file.name}: 文件内容为空`);
        continue;
      }

      const validation = validateScriptFormat(code, file.name);
      if (!validation.valid) {
        result.skipped++;
        result.errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      await importScriptToLocal(code, file.name, true);
      result.imported++;
    } catch (error) {
      result.skipped++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`${file.name}: ${errorMessage}`);
    }
  }

  return result;
};

export const isScriptFile = (filename: string): boolean => {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return VALID_SCRIPT_EXTENSIONS.includes(extension);
};

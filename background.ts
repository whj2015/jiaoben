// background.ts
// 该文件在 Service Worker 环境中运行

import { GoogleGenAI } from "@google/genai";
import { decryptText, getDeviceKeyForServiceWorker } from './utils/encryption';
import { AIGenerationStatus, AIGenerationTask } from './types';

const GM_XHR_REQUEST = 'EG_GM_xhr_request';
const GM_XHR_RESPONSE = 'EG_GM_xhr_response';

const REQUEST_TIMEOUT = 120000;
const MAX_RESPONSE_LENGTH = 100000;
const MAX_INPUT_LENGTH = 10000;
const MIN_API_KEY_LENGTH = 10;
const MAX_OUTPUT_TOKENS = 8192;
const GM_XHR_TIMEOUT = 60000;

let currentTask: AIGenerationTask | null = null;
let abortController: AbortController | null = null;

interface ScriptInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  code: string;
  enabled: boolean;
  match?: string[];
  exclude?: string[];
}

interface XHRPayload {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
}

// GM API 类型定义
interface GMInfo {
  script: {
    name: string;
    version: string;
    description: string;
  };
}

interface GMXHRResponse {
  finalUrl?: string;
  readyState: number;
  status?: number;
  statusText?: string;
  responseHeaders?: string;
  responseText?: string;
  response?: string;
  context?: unknown;
}

interface GMXHRDetails {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  binary?: boolean;
  context?: unknown;
  timeout?: number;
  onload?: (response: GMXHRResponse) => void;
  onerror?: (error: { error: string; status?: number; statusText?: string }) => void;
}

type GMSetValue = (key: string, value: unknown) => void;
type GMGetValue = (key: string, defaultValue?: unknown) => unknown;
type GMLog = (message: unknown) => void;
type GMXHR = (details: GMXHRDetails) => { abort: () => void };

// 注意：GM API 类型仅用于类型定义
// 实际赋值在 executeScript 的 func 中通过类型断言完成

const tabScriptCounts: Record<number, number> = {};

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'ftp:', 'file:'];
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeScriptName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').substring(0, 200);
}

function updateBadge(tabId: number) {
  if (typeof chrome === 'undefined' || !chrome.action) return;

  const count = tabScriptCounts[tabId] || 0;

  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString(), tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#DC2626', tabId });
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ color: '#FFFFFF', tabId });
    }
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

function matchesRule(url: string, rule: string): boolean {
  if (!url || !rule) return false;
  
  const escapeRegex = (str: string) => str.replace(/([.+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  const regexString = "^" + rule.split("*").map(escapeRegex).join(".*") + "$";
  const regex = new RegExp(regexString);
  return regex.test(url);
}

function sanitizeUserInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .substring(0, MAX_INPUT_LENGTH);
}

function validateApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false;
  if (apiKey.trim().length < MIN_API_KEY_LENGTH) return false;
  return true;
}

async function getStoredApiKey(): Promise<string> {
  try {
    const result = await chrome.storage.sync.get(['gemini_api_key']);
    const encrypted = result.gemini_api_key || '';
    if (encrypted) {
      await getDeviceKeyForServiceWorker();
      return await decryptText(encrypted);
    }
    return '';
  } catch {
    return '';
  }
}

async function getStoredDeepSeekKey(): Promise<string> {
  try {
    const result = await chrome.storage.sync.get(['deepseek_api_key']);
    const encrypted = result.deepseek_api_key || '';
    if (encrypted) {
      await getDeviceKeyForServiceWorker();
      return await decryptText(encrypted);
    }
    return '';
  } catch {
    return '';
  }
}

async function getStoredAIProvider(): Promise<string> {
  try {
    const result = await chrome.storage.local.get(['ai_provider']);
    return result.ai_provider || 'GOOGLE';
  } catch {
    return 'GOOGLE';
  }
}

async function saveGenerationTask(task: AIGenerationTask): Promise<void> {
  try {
    await chrome.storage.local.set({ ai_generation_task: task });
  } catch (e) {
    console.error('[Background] Failed to save generation task:', e);
  }
}

async function loadGenerationTask(): Promise<AIGenerationTask | null> {
  try {
    const result = await chrome.storage.local.get(['ai_generation_task']);
    return result.ai_generation_task || null;
  } catch {
    return null;
  }
}

async function clearGenerationTask(): Promise<void> {
  try {
    await chrome.storage.local.remove(['ai_generation_task']);
  } catch (e) {
    console.error('[Background] Failed to clear generation task:', e);
  }
}

function getTaskStatus(task: AIGenerationTask | null): AIGenerationStatus {
  if (!task) {
    return {
      isGenerating: false,
      scriptId: null,
      scriptName: '',
      progress: '',
      generatedCode: ''
    };
  }
  return {
    isGenerating: task.status === 'generating',
    scriptId: task.scriptId,
    scriptName: task.scriptName,
    progress: task.progress,
    generatedCode: task.generatedCode || '',
    error: task.error
  };
}

async function callGeminiStream(
  apiKey: string,
  systemInstruction: string,
  userContent: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: apiKey });
  const model = 'gemini-2.5-flash';

  const result = await ai.models.generateContentStream({
    model: model,
    contents: userContent,
    config: {
      systemInstruction: systemInstruction,
      maxOutputTokens: MAX_OUTPUT_TOKENS
    }
  });

  let totalLength = 0;
  for await (const chunk of result) {
    if (signal.aborted) {
      throw new Error('Aborted');
    }
    const text = chunk.text;
    if (text) {
      if (totalLength + text.length > MAX_RESPONSE_LENGTH) {
        onChunk(text.substring(0, MAX_RESPONSE_LENGTH - totalLength));
        break;
      }
      onChunk(text);
      totalLength += text.length;
    }
  }
}

async function callDeepSeekStream(
  apiKey: string,
  systemInstruction: string,
  userContent: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: userContent });

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      stream: true,
      max_tokens: 8192
    }),
    signal
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API Error: ${response.status} ${response.statusText} - ${errText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) {
    throw new Error('No response body');
  }

  let totalLength = 0;
  while (true) {
    if (signal.aborted) {
      throw new Error('Aborted');
    }
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        
        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content;
          if (content) {
            if (totalLength + content.length > MAX_RESPONSE_LENGTH) {
              onChunk(content.substring(0, MAX_RESPONSE_LENGTH - totalLength));
              break;
            }
            onChunk(content);
            totalLength += content.length;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

async function executeAIGeneration(task: AIGenerationTask): Promise<void> {
  const provider = await getStoredAIProvider();
  
  let apiKey = '';
  if (provider === 'GOOGLE') {
    apiKey = await getStoredApiKey();
  } else {
    apiKey = await getStoredDeepSeekKey();
  }

  if (!validateApiKey(apiKey)) {
    throw new Error('MISSING_API_KEY');
  }

  const sanitizedRequirement = sanitizeUserInput(task.requirement);
  if (!sanitizedRequirement) {
    throw new Error('Invalid requirement');
  }

  let systemPrompt = `你是一位精通 UserScript (Tampermonkey/Violentmonkey) 的 JavaScript 开发专家。
    你的任务是根据用户的需求编写完整、有效的 UserScript。
    
    关键规则：
    1. **元数据**：必须以 // ==UserScript== 代码块开头。
       - 必须设置 @namespace 为 'https://www.acgline.org/'
       - 如果脚本需要发送网络请求，必须添加 @grant GM_xmlhttpRequest
    2. **语言**：**所有的注释和 @description 元数据必须使用中文。**
    3. **纯代码**：仅返回有效的 JavaScript 代码。不要使用 markdown 代码块 (\`\`\`)。
    4. **网络请求 (重要)**：
       - **绝对禁止**使用 fetch() 或 XMLHttpRequest 进行跨域请求，会被 CORS 策略阻止。
       - 必须使用 GM_xmlhttpRequest 进行所有外部网络请求。
       - GM_xmlhttpRequest 用法示例：
         \`\`\`javascript
         GM_xmlhttpRequest({
           method: 'GET',
           url: 'https://api.example.com/data',
           onload: (response) => {
             const data = JSON.parse(response.responseText);
             console.log(data);
           },
           onerror: (error) => {
             console.error('请求失败:', error);
           }
         });
         \`\`\`
       - 如需 Promise 版本，使用 GM.xmlHttpRequest(details) 返回 Promise。
    5. **健壮性**：
       - 现代网站 (SPA, React, Vue) 内容加载是异步的。
       - **绝对不要**假设元素在 'document-end' 时立即存在。
       - 必须使用 'MutationObserver' 或 'setInterval' 等待元素出现后再操作。
       - 始终将逻辑包裹在 try-catch 块中，防止页面崩溃。
    6. **安全性**：将代码包裹在 IIFE (立即调用函数表达式) 中，避免污染全局命名空间。
    `;

  if (task.contextUrl) {
    systemPrompt += `\n
    上下文感知：
    用户正在浏览：${sanitizeUserInput(task.contextUrl)}
    - 设置 @match 以匹配此域名 (例如 *://example.com/*)。
    - 针对此网站的结构编写逻辑。
    `;
  } else {
    systemPrompt += `\n根据需求包含智能的 @match 规则。`;
  }

  let userContent = sanitizedRequirement;

  if (task.currentCode) {
    systemPrompt = `你是一位 UserScript 开发专家。
    你的任务是修改现有的 UserScript 以满足新的需求，同时严格保留现有功能。
    
    更新模式的关键规则：
    1. **禁止回退 (最重要)**：除非与新需求直接冲突，否则**绝对不要**删除或破坏现有的逻辑。当前代码被认为是有效且有价值的。
    2. **增量式方法**：优先添加新函数、变量或事件监听器，而不是重写整个脚本结构。
    3. **命名空间完整性**：确保 @namespace 保持为 'https://www.acgline.org/'。
    4. **元数据保留**：除非明确要求更改，否则保留现有的 @name, @match 和其他元数据。
       - 如果新增网络请求功能，确保添加 @grant GM_xmlhttpRequest
    5. **完整输出**：返回**完整的**更新后脚本代码，而不仅仅是修改部分。
    6. **格式**：仅返回有效的 JavaScript。不要使用 markdown 代码块 (\`\`\`)。
    7. **语言**：**代码中的所有注释和解释必须使用中文。**
    8. **网络请求**：
       - **绝对禁止**使用 fetch() 或 XMLHttpRequest 进行跨域请求。
       - 必须使用 GM_xmlhttpRequest 进行外部网络请求。
    9. **健壮性**：确保新旧逻辑都能优雅地处理动态 DOM 加载 (SPA)。
    10. **版本控制**：分析所做的更改。根据语义化版本控制自动增加元数据块中的 @version 号：
       - **补丁 (Patch)** (例如 0.1.0 -> 0.1.1): 用于错误修复、微调或小调整。
       - **次要 (Minor)** (例如 0.1.0 -> 0.2.0): 用于新功能、新函数或重大逻辑更改。
       - **主要 (Major)** (例如 1.0.0 -> 2.0.0): 用于完全重写或破坏性更改。
    `;

    if (task.contextUrl) {
      systemPrompt += `\n上下文 URL: ${sanitizeUserInput(task.contextUrl)} (使用此 URL 验证逻辑是否符合当前站点)`;
    }

    userContent = `原始代码：\n${task.currentCode}\n\n新需求：\n${sanitizedRequirement}\n\n指令：\n将新需求应用于原始代码，且不丢失现有功能。适当更新 @version。返回完整的更新后代码。`;
  }

  if (!abortController) {
    abortController = new AbortController();
  }
  const signal = abortController.signal;

  if (provider === 'GOOGLE') {
    await callGeminiStream(apiKey, systemPrompt, userContent, (text) => {
      if (currentTask) {
        currentTask.generatedCode += text;
        currentTask.progress = `AI 正在生成... (${currentTask.generatedCode.split('\n').length} 行)`;
        saveGenerationTask(currentTask);
      }
    }, signal);
  } else {
    await callDeepSeekStream(apiKey, systemPrompt, userContent, (text) => {
      if (currentTask) {
        currentTask.generatedCode += text;
        currentTask.progress = `AI 正在生成... (${currentTask.generatedCode.split('\n').length} 行)`;
        saveGenerationTask(currentTask);
      }
    }, signal);
  }
}

async function startAIGeneration(
  requirement: string,
  scriptId: string | null,
  scriptName: string,
  currentCode?: string,
  contextUrl?: string
): Promise<AIGenerationStatus> {
  if (currentTask && currentTask.status === 'generating') {
    return getTaskStatus(currentTask);
  }

  abortController = new AbortController();

  currentTask = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    status: 'generating',
    scriptId,
    scriptName,
    progress: 'AI 正在生成...',
    generatedCode: '',
    startTime: Date.now(),
    requirement,
    currentCode,
    contextUrl
  };

  await saveGenerationTask(currentTask);

  executeAIGeneration(currentTask)
    .then(async () => {
      if (currentTask) {
        currentTask.status = 'completed';
        currentTask.progress = '生成完成';
        await saveGenerationTask(currentTask);
      }
    })
    .catch(async (error) => {
      if (currentTask) {
        currentTask.status = 'error';
        currentTask.error = error.message === 'MISSING_API_KEY' ? '缺少 API Key' : error.message;
        currentTask.progress = '生成失败';
        await saveGenerationTask(currentTask);
      }
    });

  return getTaskStatus(currentTask);
}

function cancelAIGeneration(): AIGenerationStatus {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  
  if (currentTask) {
    currentTask.status = 'error';
    currentTask.error = '用户取消';
    currentTask.progress = '已取消';
    saveGenerationTask(currentTask);
  }
  
  return getTaskStatus(currentTask);
}

async function getAIGenerationStatus(): Promise<AIGenerationStatus> {
  if (!currentTask) {
    currentTask = await loadGenerationTask();
    
    if (currentTask && currentTask.status === 'generating') {
      const elapsed = Date.now() - currentTask.startTime;
      if (elapsed > REQUEST_TIMEOUT + 30000) {
        currentTask.status = 'error';
        currentTask.error = '生成超时';
        await saveGenerationTask(currentTask);
      }
    }
  }
  
  return getTaskStatus(currentTask);
}

async function completeAIGeneration(): Promise<AIGenerationStatus> {
  const status = await getAIGenerationStatus();
  
  if (currentTask && (currentTask.status === 'completed' || currentTask.status === 'error')) {
    const finalStatus = getTaskStatus(currentTask);
    currentTask = null;
    await clearGenerationTask();
    return finalStatus;
  }
  
  return status;
}

if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (changeInfo.status === 'loading') {
      tabScriptCounts[tabId] = 0;
      updateBadge(tabId);
    }
    
    if (changeInfo.status === 'complete' && tab.url && isValidUrl(tab.url)) {
      checkAndInjectScripts(tabId, tab.url);
    }
  });

  chrome.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
    updateBadge(activeInfo.tabId);
  });

  chrome.tabs.onRemoved.addListener((tabId: number) => {
    delete tabScriptCounts[tabId];
  });

  chrome.runtime.onMessage.addListener((message: { type: string; payload: unknown }, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    if (message.type === 'GM_XHR') {
      const { method, url, headers, data } = message.payload as XHRPayload;
      
      console.log('[Background] GM_XHR request received:', { method, url, headers: headers ? Object.keys(headers) : [] });
      
      if (!url || !isValidUrl(url)) {
        console.error('[Background] GM_XHR invalid URL:', url);
        sendResponse({ error: `Invalid URL: ${url}`, status: 0, statusText: 'Invalid URL' });
        return true;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[Background] GM_XHR request timeout:', url);
        controller.abort();
      }, GM_XHR_TIMEOUT);

      const startTime = Date.now();
      
      fetch(url, {
        method: method || 'GET',
        headers: headers,
        body: ['GET', 'HEAD'].includes((method || 'GET').toUpperCase()) ? undefined : data,
        signal: controller.signal
      })
      .then(async (res) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.log(`[Background] GM_XHR response received: ${res.status} ${res.statusText} (${duration}ms)`, url);
        
        const text = await res.text();
        const responseHeaders = Array.from(res.headers.entries())
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n');

        console.log(`[Background] GM_XHR response size: ${text.length} bytes`);

        sendResponse({
          status: res.status,
          statusText: res.statusText,
          responseHeaders: responseHeaders,
          responseText: text,
          finalUrl: res.url
        });
      })
      .catch(err => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        if (err.name === 'AbortError') {
          console.error(`[Background] GM_XHR timeout after ${duration}ms:`, url);
          sendResponse({ 
            error: `Request timeout after ${GM_XHR_TIMEOUT / 1000}s`, 
            status: 0, 
            statusText: 'Timeout',
            url: url
          });
        } else {
          console.error('[Background] GM_XHR error:', err.message || err, url);
          sendResponse({ 
            error: err instanceof Error ? err.message : 'Unknown error',
            status: 0,
            statusText: 'Network Error',
            url: url
          });
        }
      });
      
      return true;
    }
    
    if (message.type === 'AI_GENERATE_START') {
      const payload = message.payload as {
        requirement: string;
        scriptId: string | null;
        scriptName: string;
        currentCode?: string;
        contextUrl?: string;
      };
      
      startAIGeneration(
        payload.requirement,
        payload.scriptId,
        payload.scriptName,
        payload.currentCode,
        payload.contextUrl
      ).then(status => {
        sendResponse(status);
      });
      
      return true;
    }
    
    if (message.type === 'AI_GENERATE_STATUS') {
      getAIGenerationStatus().then(status => {
        sendResponse(status);
      });
      return true;
    }
    
    if (message.type === 'AI_GENERATE_CANCEL') {
      const status = cancelAIGeneration();
      sendResponse(status);
      return true;
    }
    
    if (message.type === 'AI_GENERATE_COMPLETE') {
      completeAIGeneration().then(status => {
        sendResponse(status);
      });
      return true;
    }
  });
}

async function checkAndInjectScripts(tabId: number, url: string) {
  try {
    const result = await chrome.storage.local.get(['user_scripts']);
    const scripts: ScriptInfo[] = result.user_scripts || [];

    const matchedScripts = scripts.filter(script => {
      if (!script.enabled) return false;
      
      if (script.exclude && script.exclude.some((rule: string) => matchesRule(url, rule))) {
        return false;
      }

      if (script.match && script.match.some((rule: string) => matchesRule(url, rule))) {
        return true;
      }
      
      return false;
    });

    tabScriptCounts[tabId] = matchedScripts.length;
    updateBadge(tabId);

    if (matchedScripts.length > 0) {
      for (const script of matchedScripts) {
        injectScript(tabId, script);
      }
    }
  } catch (e) {
    console.error("[EdgeGenius] Injection failed:", e);
  }
}

function injectScript(tabId: number, script: ScriptInfo) {
  const sanitizedName = sanitizeScriptName(script.name);
  
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (name: string, version: string, description: string, userCode: string) => {
       const GM_XHR_REQUEST = 'EG_GM_xhr_request';
       const GM_XHR_RESPONSE = 'EG_GM_xhr_response';
       
       const win = window as unknown as {
         GM_info?: GMInfo;
         GM_setValue?: GMSetValue;
         GM_getValue?: GMGetValue;
         GM_log?: GMLog;
         GM_xmlhttpRequest?: GMXHR;
         GM?: {
           xmlHttpRequest: (details: GMXHRDetails) => Promise<GMXHRResponse>;
         };
       };
       
       win.GM_info = {
         script: { name, version, description }
       };
       
       const logPrefix = `[GM:${name}]`;
       const safeLog: GMLog = (msg) => console.log(logPrefix, msg);

       const storagePrefix = `GM_${name}_`;
       win.GM_setValue = (key: string, value: unknown) => {
         try {
           localStorage.setItem(storagePrefix + key, String(value));
         } catch(e) { console.error(logPrefix, "GM_setValue failed", e); }
       };
       win.GM_getValue = (key: string, def?: unknown) => {
          return localStorage.getItem(storagePrefix + key) ?? def;
       };
       win.GM_log = safeLog;

       win.GM_xmlhttpRequest = (details: GMXHRDetails) => {
          const requestId = 'gm_xhr_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
          const timeout = (details as unknown as { timeout?: number }).timeout || 60000;
          let timeoutId: ReturnType<typeof setTimeout> | null = null;
          let isCompleted = false;
          
          console.log(`[${logPrefix}] GM_xmlhttpRequest starting:`, {
            url: details.url,
            method: details.method || 'GET',
            timeout: timeout
          });
          
          const cleanup = () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            window.removeEventListener('message', handler);
          };
          
          timeoutId = setTimeout(() => {
            if (isCompleted) return;
            isCompleted = true;
            cleanup();
            
            console.error(`[${logPrefix}] GM_xmlhttpRequest timeout:`, details.url);
            if (details.onerror) {
              details.onerror({ 
                error: `Request timeout after ${timeout / 1000}s`,
                status: 0,
                statusText: 'Timeout'
              });
            }
          }, timeout);
          
          const handler = (event: MessageEvent) => {
             if (event.source !== window) return;
             if (event.data?.type !== GM_XHR_RESPONSE) return;
             
             const { requestId: respId, error, ...response } = event.data;
             if (respId !== requestId) return;
             
             if (isCompleted) return;
             isCompleted = true;
             cleanup();
             
             if (error) {
               console.error(`[${logPrefix}] GM_xmlhttpRequest error:`, error, details.url);
               if (details.onerror) {
                 details.onerror({ 
                   error,
                   status: response.status || 0,
                   statusText: response.statusText || 'Error'
                 });
               }
             } else {
               console.log(`[${logPrefix}] GM_xmlhttpRequest success:`, {
                 status: response.status,
                 statusText: response.statusText,
                 responseSize: response.responseText?.length || 0,
                 url: details.url
               });
               const respObj: GMXHRResponse = {
                 finalUrl: response.finalUrl,
                 readyState: 4,
                 status: response.status,
                 statusText: response.statusText,
                 responseHeaders: response.responseHeaders,
                 responseText: response.responseText,
                 response: response.responseText,
                 context: details.context
               };
               if (details.onload) details.onload(respObj);
             }
          };

          window.addEventListener('message', handler);

          window.postMessage({
             type: GM_XHR_REQUEST,
             requestId,
             method: details.method,
             url: details.url,
             headers: details.headers,
             data: details.data,
             binary: details.binary
          }, '*');

          return {
             abort: () => { 
                if (isCompleted) return;
                isCompleted = true;
                cleanup();
                console.log(`[${logPrefix}] GM_xmlhttpRequest aborted:`, details.url);
             }
          };
       };

       win.GM = win.GM || { xmlHttpRequest: () => Promise.resolve({} as GMXHRResponse) };
       win.GM.xmlHttpRequest = (details: GMXHRDetails) => {
          return new Promise<GMXHRResponse>((resolve, reject) => {
             if (win.GM_xmlhttpRequest) {
               win.GM_xmlhttpRequest({
                  ...details,
                  onload: resolve,
                  onerror: reject
               });
             } else {
               reject(new Error('GM_xmlhttpRequest not available'));
             }
          });
       };
       
       try {
         const scriptEl = document.createElement('script');
         scriptEl.textContent = `
           (function() {
             'use strict';
             try {
               ${userCode}
             } catch (e) {
               console.error("${logPrefix} Runtime Error:", e);
             }
           })();
         `;
         (document.head || document.documentElement).appendChild(scriptEl);
         scriptEl.remove();
         // Script injected successfully
       } catch (e) {
         console.error(`${logPrefix} Injection failed:`, e);
       }
    },
    args: [sanitizedName, script.version, script.description || '', script.code],
    world: 'MAIN',
  }).catch(err => {
    console.error(`[EdgeGenius] Failed to inject script ${sanitizedName}:`, err);
  });
}

// background.ts
// 该文件在 Service Worker 环境中运行

import { GM_XHR_REQUEST, GM_XHR_RESPONSE } from './utils/constants';

// TabInfo interface removed as it was unused locally

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
  onload?: (response: GMXHRResponse) => void;
  onerror?: (error: { error: string }) => void;
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

  chrome.runtime.onMessage.addListener((message: { type: string; payload: XHRPayload }, _sender: chrome.runtime.MessageSender, sendResponse: (response?: { status?: number; statusText?: string; responseHeaders?: string; responseText?: string; finalUrl?: string; error?: string }) => void) => {
    if (message.type === 'GM_XHR') {
      const { method, url, headers, data } = message.payload;
      
      if (!url || !isValidUrl(url)) {
        sendResponse({ error: 'Invalid URL' });
        return true;
      }

      fetch(url, {
        method: method || 'GET',
        headers: headers,
        body: ['GET', 'HEAD'].includes((method || 'GET').toUpperCase()) ? undefined : data
      })
      .then(async (res) => {
        const text = await res.text();
        const responseHeaders = Array.from(res.headers.entries())
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n');

        sendResponse({
          status: res.status,
          statusText: res.statusText,
          responseHeaders: responseHeaders,
          responseText: text,
          finalUrl: res.url
        });
      })
      .catch(err => {
        console.error('[Background] XHR error:', err);
        sendResponse({ error: err instanceof Error ? err.message : 'Unknown error' });
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
          
          const handler = (event: Event) => {
             const customEvent = event as CustomEvent;
             const detail = customEvent.detail as { requestId: string; error?: string } & Partial<GMXHRResponse>;
             const { requestId: respId, error, ...response } = detail;
             if (respId !== requestId) return;
             
             window.removeEventListener(GM_XHR_RESPONSE, handler);
             
             if (error) {
               if (details.onerror) details.onerror({ error });
             } else {
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

          window.addEventListener(GM_XHR_RESPONSE, handler);

          window.dispatchEvent(new CustomEvent(GM_XHR_REQUEST, {
             detail: {
               requestId,
               method: details.method,
               url: details.url,
               headers: details.headers,
               data: details.data,
               binary: details.binary
             }
          }));

          return {
             abort: () => { 
                window.removeEventListener(GM_XHR_RESPONSE, handler);
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

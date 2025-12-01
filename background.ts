// background.ts
// 该文件在 Service Worker 环境中运行

// TypeScript 声明，避免 chrome 未定义的错误
declare var chrome: any;

// 追踪每个标签页激活的脚本数量
const tabScriptCounts: Record<number, number> = {};

/**
 * 更新扩展图标上的角标 (Badge)
 * 显示当前页面运行的脚本数量，背景设为红色
 */
function updateBadge(tabId: number) {
  if (typeof chrome === 'undefined' || !chrome.action) return;

  const count = tabScriptCounts[tabId] || 0;

  if (count > 0) {
    // 设置文字为脚本数量
    chrome.action.setBadgeText({ text: count.toString(), tabId });
    // 设置背景颜色为红色
    chrome.action.setBadgeBackgroundColor({ color: '#DC2626', tabId });
    // 设置文字颜色为白色 (部分浏览器支持)
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ color: '#FFFFFF', tabId });
    }
  } else {
    // 清除角标
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

// 简单的 URL 匹配函数 (支持 * 通配符)
function matchesRule(url: string, rule: string): boolean {
  // 将通配符 * 转换为正则 .*
  const escapeRegex = (str: string) => str.replace(/([.+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  const regexString = "^" + rule.split("*").map(escapeRegex).join(".*") + "$";
  const regex = new RegExp(regexString);
  return regex.test(url);
}

// 监听标签页更新 (页面加载完成时注入)
if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: any, tab: any) => {
    // 清除旧状态
    if (changeInfo.status === 'loading') {
      tabScriptCounts[tabId] = 0;
      updateBadge(tabId);
    }
    
    if (changeInfo.status === 'complete' && tab.url) {
      checkAndInjectScripts(tabId, tab.url);
    }
  });

  // 监听标签页切换 (切换时更新角标显示)
  chrome.tabs.onActivated.addListener((activeInfo: any) => {
    updateBadge(activeInfo.tabId);
  });

  // 监听标签页关闭 (清理内存)
  chrome.tabs.onRemoved.addListener((tabId: number) => {
    delete tabScriptCounts[tabId];
  });

  // 监听来自 Content Script 的消息 (处理 GM_xmlhttpRequest)
  chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    if (message.type === 'GM_XHR') {
      const { method, url, headers, data } = message.payload;
      
      // 在 Background 执行 fetch，拥有跨域权限
      fetch(url, {
        method: method || 'GET',
        headers: headers,
        body: ['GET', 'HEAD'].includes((method || 'GET').toUpperCase()) ? undefined : data
      })
      .then(async (res) => {
        const text = await res.text();
        // 简单处理 headers
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
        sendResponse({ error: err.message });
      });
      
      return true; // 保持通道开启以进行异步响应
    }
  });
}

async function checkAndInjectScripts(tabId: number, url: string) {
  try {
    const result = await chrome.storage.local.get(['user_scripts']);
    const scripts: any[] = result.user_scripts || [];

    const matchedScripts = scripts.filter(script => {
      if (!script.enabled) return false;
      
      // 检查 Exclude
      if (script.exclude && script.exclude.some((rule: string) => matchesRule(url, rule))) {
        return false;
      }

      // 检查 Match
      if (script.match && script.match.some((rule: string) => matchesRule(url, rule))) {
        return true;
      }
      
      return false;
    });

    // 更新当前 Tab 的计数并刷新角标
    tabScriptCounts[tabId] = matchedScripts.length;
    updateBadge(tabId);

    if (matchedScripts.length > 0) {
      console.log(`[EdgeGenius] Injecting ${matchedScripts.length} scripts into ${url}`);
      
      for (const script of matchedScripts) {
        injectScript(tabId, script);
      }
    }
  } catch (e) {
    console.error("[EdgeGenius] Injection failed:", e);
  }
}

function injectScript(tabId: number, script: any) {
  // 使用 func + args 的方式注入，避免字符串拼接导致的 SyntaxError
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (name: string, version: string, description: string, userCode: string) => {
       // --- 1. 定义 GM API 环境 ---
       
       (window as any).GM_info = {
         script: { name, version, description }
       };
       
       const logPrefix = `[GM:${name}]`;
       const safeLog = (msg: any) => console.log(logPrefix, msg);

       // 简单的存储模拟 (基于 localStorage)
       const storagePrefix = `GM_${name}_`;
       (window as any).GM_setValue = (key: string, value: any) => {
         try {
           localStorage.setItem(storagePrefix + key, String(value));
         } catch(e) { console.error(logPrefix, "GM_setValue failed", e); }
       };
       (window as any).GM_getValue = (key: string, def: any) => {
          return localStorage.getItem(storagePrefix + key) || def;
       };
       (window as any).GM_log = safeLog;

       // GM_xmlhttpRequest 实现 (通过 CustomEvent -> Content Script -> Background)
       (window as any).GM_xmlhttpRequest = (details: any) => {
          const requestId = 'gm_xhr_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
          
          // 响应处理器
          const handler = (event: any) => {
             const { requestId: respId, error, ...response } = event.detail;
             if (respId !== requestId) return;
             
             window.removeEventListener('EG_GM_xhr_response', handler);
             
             if (error) {
               if (details.onerror) details.onerror({ error });
             } else {
               // 构造符合 GM 标准的响应对象
               const respObj = {
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

          window.addEventListener('EG_GM_xhr_response', handler);

          // 发送请求事件
          window.dispatchEvent(new CustomEvent('EG_GM_xhr_request', {
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
                // 简化版暂不支持 abort
                window.removeEventListener('EG_GM_xhr_response', handler);
             }
          };
       };

       // 兼容 GM.xmlHttpRequest (Promise 风格)
       (window as any).GM = (window as any).GM || {};
       (window as any).GM.xmlHttpRequest = (details: any) => {
          return new Promise((resolve, reject) => {
             (window as any).GM_xmlhttpRequest({
                ...details,
                onload: resolve,
                onerror: reject
             });
          });
       };

       // --- 2. 注入并执行用户脚本 ---
       
       try {
         const scriptEl = document.createElement('script');
         // 将用户代码包裹在 IIFE 中，并加上 try-catch
         scriptEl.textContent = `
           (function() {
             try {
               ${userCode}
             } catch (e) {
               console.error("${logPrefix} Runtime Error:", e);
             }
           })();
         `;
         (document.head || document.documentElement).appendChild(scriptEl);
         scriptEl.remove(); // 执行后移除标签保持 DOM 清洁
         console.log(`${logPrefix} Injected successfully.`);
       } catch (e) {
         console.error(`${logPrefix} Injection failed:`, e);
       }
    },
    args: [script.name, script.version, script.description || '', script.code],
    world: 'MAIN', // 在主世界执行
  });
}
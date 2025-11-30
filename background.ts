// background.ts
// 该文件在 Service Worker 环境中运行

// TypeScript 声明，避免 chrome 未定义的错误
declare var chrome: any;

// 简单的 URL 匹配函数 (支持 * 通配符)
function matchesRule(url: string, rule: string): boolean {
  // 将通配符 * 转换为正则 .*
  const escapeRegex = (str: string) => str.replace(/([.+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  const regexString = "^" + rule.split("*").map(escapeRegex).join(".*") + "$";
  const regex = new RegExp(regexString);
  return regex.test(url);
}

// 监听标签页更新
if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: any, tab: any) => {
    if (changeInfo.status === 'complete' && tab.url) {
      checkAndInjectScripts(tabId, tab.url);
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
       // 在页面上下文中构建执行环境
       // 1. 定义简单的 GM_info 和 GM_log
       (window as any).GM_info = {
         script: { name, version, description }
       };
       
       const logPrefix = `[GM:${name}]`;
       const safeLog = (msg: any) => console.log(logPrefix, msg);

       // 2. 简单的存储模拟 (基于 localStorage)
       // 注意：这是运行在页面上下文的，真实的扩展通常通过 postMessage 和 background 通信
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

       // 3. 构建并插入 Script 标签
       // 这是最安全的方法，将代码作为文本节点插入，避免了 eval 或特殊的转义问题
       try {
         const scriptEl = document.createElement('script');
         // 将用户代码包裹在 IIFE 中，并加上 try-catch
         // 我们使用 textContent 赋值，不需要对 userCode 进行 JSON.stringify 转义，浏览器会处理
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
    world: 'MAIN', // 在主世界执行，以便访问 window 对象和页面 DOM
  });
}

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
  // 包装用户代码，提供基本的 GM API 模拟
  const wrappedCode = `
    (function() {
      // 简单的 GM API 模拟
      const GM_info = {
        script: {
          name: "${script.name}",
          version: "${script.version}",
          description: "${script.description}"
        }
      };

      const GM_log = (message) => console.log("[GM:${script.name}]", message);
      
      // 注意：真实的 GM_getValue/setValue 需要通过 sendMessage 与 background 通信
      // 这里仅做简单的内存模拟，防止报错
      const GM_setValue = (key, value) => localStorage.setItem("GM_${script.id}_" + key, value);
      const GM_getValue = (key, def) => localStorage.getItem("GM_${script.id}_" + key) || def;

      try {
        ${script.code}
      } catch (e) {
        console.error("[EdgeGenius] Script error in '${script.name}':", e);
      }
    })();
  `;

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (code: string) => {
       const el = document.createElement('script');
       el.textContent = code;
       document.head.appendChild(el);
       el.remove();
    },
    args: [wrappedCode],
    world: 'MAIN', // 在主世界执行，以便访问 window 对象
  });
}
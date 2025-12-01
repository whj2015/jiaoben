// assets/content.ts
// Runs in Isolated World
declare var chrome: any;

console.log('[EdgeGenius] Content Bridge Loaded');

// 1. Initialize: Ask background for scripts matching this URL
const currentUrl = window.location.href;
chrome.runtime.sendMessage({ type: 'GET_SCRIPTS_FOR_URL', url: currentUrl }, (response: any) => {
  if (response && response.scripts && response.scripts.length > 0) {
    response.scripts.forEach((script: any) => {
      injectScriptWithSandbox(script);
    });
  }
});

// 2. Setup Messaging Listener for Main World (GM_xmlhttpRequest from script)
window.addEventListener('EG_GM_bridge_request', async (event: any) => {
  const { action, args, scriptId, requestId } = event.detail;
  
  // Forward to Background
  chrome.runtime.sendMessage({
    type: 'GM_API_CALL',
    scriptId,
    action,
    args
  }, (response: any) => {
    // Reply to Main World
    window.dispatchEvent(new CustomEvent(`EG_GM_bridge_response_${requestId}`, {
      detail: response
    }));
  });
});

/**
 * Injects the script into the Main World wrapped in a sandbox closure
 * that provides GM_* APIs.
 */
function injectScriptWithSandbox(script: any) {
  const scriptId = script.id;
  const storageSnapshot = script.storage || {};
  const requires = script.requiresContent || {};

  // Construct the Sandbox Code
  // We serialize the storage snapshot so GM_getValue is synchronous
  const sandboxCode = `
  (function() {
    const scriptId = "${scriptId}";
    const storageSnapshot = ${JSON.stringify(storageSnapshot)};
    
    // --- GM API Implementation (Main World) ---
    
    const GM_info = {
      script: {
        name: "${script.metadata.name}",
        version: "${script.metadata.version}",
        description: "${script.metadata.description}",
        namespace: "${script.metadata.namespace}"
      }
    };

    // Helper: Call Background via Content Script Bridge
    function callBridge(action, args) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2);
        
        const handler = (e) => {
          window.removeEventListener("EG_GM_bridge_response_" + requestId, handler);
          if (e.detail.success) resolve(e.detail.data);
          else reject(e.detail.error);
        };
        window.addEventListener("EG_GM_bridge_response_" + requestId, handler);
        
        window.dispatchEvent(new CustomEvent("EG_GM_bridge_request", {
          detail: { scriptId, action, args, requestId }
        }));
      });
    }

    // Storage: Read from snapshot, Write to Bridge + Update Snapshot
    function GM_getValue(key, def) {
      return Object.prototype.hasOwnProperty.call(storageSnapshot, key) ? storageSnapshot[key] : def;
    }
    
    function GM_setValue(key, value) {
      storageSnapshot[key] = value; // Optimistic update
      callBridge('GM_setValue', [key, value]);
    }

    function GM_deleteValue(key) {
      delete storageSnapshot[key];
      callBridge('GM_deleteValue', [key]);
    }
    
    function GM_listValues() {
      return Object.keys(storageSnapshot);
    }

    // XHR
    function GM_xmlhttpRequest(details) {
      callBridge('GM_xmlhttpRequest', [details]).then(resp => {
        if (details.onload) details.onload(resp);
      }).catch(err => {
        if (details.onerror) details.onerror({ error: err });
      });
    }

    // Notification
    function GM_notification(text, title, image, onclick) {
      if (typeof text === 'object') {
        callBridge('GM_notification', [text]); // details object
      } else {
        callBridge('GM_notification', [{ text, title, image }]);
      }
    }
    
    function GM_setClipboard(data, info) {
      callBridge('GM_setClipboard', [data, info]);
    }
    
    function GM_log(message) {
      console.log("[GM:${script.metadata.name}]", message);
    }

    // --- Inject @require libs ---
    ${Object.values(requires).join('\n;')}

    // --- User Script ---
    try {
      (function(GM_info, GM_getValue, GM_setValue, GM_deleteValue, GM_listValues, GM_xmlhttpRequest, GM_notification, GM_setClipboard, GM_log) {
         ${script.code}
      })(GM_info, GM_getValue, GM_setValue, GM_deleteValue, GM_listValues, GM_xmlhttpRequest, GM_notification, GM_setClipboard, GM_log);
    } catch(e) {
      console.error("[EdgeGenius] Script Error:", e);
    }

  })();
  `;

  const scriptEl = document.createElement('script');
  scriptEl.textContent = sandboxCode;
  (document.head || document.documentElement).appendChild(scriptEl);
  scriptEl.remove();
}

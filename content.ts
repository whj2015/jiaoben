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

  // Securely serialize values to avoid syntax errors with backticks/newlines in user code
  const safeScriptId = JSON.stringify(scriptId);
  const safeStorage = JSON.stringify(storageSnapshot);
  const safeMetadata = JSON.stringify(script.metadata);
  const safeCode = JSON.stringify(script.code);
  const safeRequires = JSON.stringify(Object.values(requires).join('\n;\n'));

  // Construct the Sandbox Code
  const sandboxCode = `
  (function() {
    const scriptId = ${safeScriptId};
    const storageSnapshot = ${safeStorage};
    const meta = ${safeMetadata};
    
    // --- GM API Implementation (Main World) ---
    
    const GM_info = {
      script: meta,
      scriptHandler: "EdgeGenius",
      version: "3.0.0"
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
    const GM_getValue = function(key, def) {
      return Object.prototype.hasOwnProperty.call(storageSnapshot, key) ? storageSnapshot[key] : def;
    };
    
    const GM_setValue = function(key, value) {
      storageSnapshot[key] = value; // Optimistic update
      callBridge('GM_setValue', [key, value]);
    };

    const GM_deleteValue = function(key) {
      delete storageSnapshot[key];
      callBridge('GM_deleteValue', [key]);
    };
    
    const GM_listValues = function() {
      return Object.keys(storageSnapshot);
    };

    // XHR
    const GM_xmlhttpRequest = function(details) {
      callBridge('GM_xmlhttpRequest', [details]).then(resp => {
        if (details.onload) details.onload(resp);
      }).catch(err => {
        if (details.onerror) details.onerror({ error: err });
      });
    };

    // Notification
    const GM_notification = function(text, title, image, onclick) {
      if (typeof text === 'object') {
        callBridge('GM_notification', [text]); // details object
      } else {
        callBridge('GM_notification', [{ text, title, image }]);
      }
    };
    
    const GM_setClipboard = function(data, info) {
      callBridge('GM_setClipboard', [data, info]);
    };
    
    const GM_log = function(message) {
      console.log("[GM:" + meta.name + "]", message);
    };

    // Define window.GM for V4 compatibility
    window.GM = {
       info: GM_info,
       xmlHttpRequest: GM_xmlhttpRequest,
       setValue: GM_setValue,
       getValue: GM_getValue,
       deleteValue: GM_deleteValue,
       listValues: GM_listValues,
       notification: GM_notification,
       setClipboard: GM_setClipboard
    };

    // --- Execute Logic ---
    
    // 1. Inject @require libs
    const requiresCode = ${safeRequires};
    if (requiresCode) {
       try {
         // Execute requires in the global scope (of this IIFE/Window)
         (new Function(requiresCode))();
       } catch(e) { console.error("[EdgeGenius] Error loading @require:", e); }
    }

    // 2. Inject User Script
    const userCode = ${safeCode};
    try {
      // Create a function that takes the GM APIs as arguments
      // This mimics the sandbox environment where these are available globally
      const apiNames = ["GM_info", "GM_getValue", "GM_setValue", "GM_deleteValue", "GM_listValues", "GM_xmlhttpRequest", "GM_notification", "GM_setClipboard", "GM_log"];
      const apiValues = [GM_info, GM_getValue, GM_setValue, GM_deleteValue, GM_listValues, GM_xmlhttpRequest, GM_notification, GM_setClipboard, GM_log];
      
      // new Function(arg1, arg2, ..., body)
      const fn = new Function(...apiNames, userCode);
      fn.apply(window, apiValues);
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
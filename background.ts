// background.ts
declare var chrome: any;

import { UserScript } from './types';

// Helper: Match URL pattern
const matchesRule = (url: string, rule: string): boolean => {
  if (rule === '<all_urls>') return true;
  if (!rule) return false;
  
  // Basic glob to regex
  const escapeRegex = (str: string) => str.replace(/([.+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  let regexStr = "^" + rule.split("*").map(escapeRegex).join(".*") + "$";
  return new RegExp(regexStr).test(url);
};

// 1. Script Dispatcher
// When content script loads, it requests scripts for the current URL
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  if (message.type === 'GET_SCRIPTS_FOR_URL') {
    const url = message.url;
    
    chrome.storage.local.get(['user_scripts'], (result: any) => {
      const allScripts: UserScript[] = result.user_scripts || [];
      const matchedScripts = allScripts.filter(script => {
        if (!script.enabled) return false;
        
        // Check Exclude
        if (script.metadata.exclude?.some(r => matchesRule(url, r))) return false;
        
        // Check Match/Include
        const hasMatch = (script.metadata.match || []).some(r => matchesRule(url, r));
        const hasInclude = (script.metadata.include || []).some(r => matchesRule(url, r));
        
        return hasMatch || hasInclude;
      });

      // Update badge
      if (sender.tab?.id) {
        updateBadge(sender.tab.id, matchedScripts.length);
      }

      sendResponse({ scripts: matchedScripts });
    });
    return true; // Async response
  }
  
  // 2. GM API Handler
  if (message.type === 'GM_API_CALL') {
    handleGMApiCall(message, sender).then(response => {
      sendResponse(response);
    });
    return true;
  }
});

async function handleGMApiCall(message: any, sender: any) {
  const { action, args, scriptId } = message;
  
  switch (action) {
    case 'GM_xmlhttpRequest': {
      const [details] = args;
      try {
        const response = await fetch(details.url, {
          method: details.method || 'GET',
          headers: details.headers,
          body: details.data
        });
        const text = await response.text();
        // Convert headers
        const headersStr = Array.from(response.headers.entries()).map(([k,v]) => `${k}: ${v}`).join('\r\n');
        
        return {
          success: true,
          data: {
            status: response.status,
            statusText: response.statusText,
            readyState: 4,
            responseHeaders: headersStr,
            responseText: text,
            finalUrl: response.url
          }
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    
    case 'GM_setValue': {
      const [key, value] = args;
      // Get current scripts to find the specific script's storage
      const result = await chrome.storage.local.get(['user_scripts']);
      const scripts: UserScript[] = result.user_scripts || [];
      const index = scripts.findIndex(s => s.id === scriptId);
      
      if (index >= 0) {
        if (!scripts[index].storage) scripts[index].storage = {};
        scripts[index].storage![key] = value;
        await chrome.storage.local.set({ user_scripts: scripts });
        return { success: true };
      }
      return { success: false, error: 'Script not found' };
    }
    
    case 'GM_deleteValue': {
      const [key] = args;
      const result = await chrome.storage.local.get(['user_scripts']);
      const scripts: UserScript[] = result.user_scripts || [];
      const index = scripts.findIndex(s => s.id === scriptId);
      
      if (index >= 0 && scripts[index].storage) {
        delete scripts[index].storage![key];
        await chrome.storage.local.set({ user_scripts: scripts });
        return { success: true };
      }
      return { success: true };
    }
    
    case 'GM_notification': {
      const [details] = args; // text, title, image, onclick
      const notifId = `gm_notif_${Date.now()}_${Math.random()}`;
      
      chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: details.image || 'icon.png', // Requires default icon in manifest or valid URL
        title: details.title || 'Script Notification',
        message: details.text || '',
      });
      return { success: true };
    }
    
    case 'GM_setClipboard': {
      const [data] = args;
      // Background clipboard write is limited in MV3 without offscreen document
      // For now, we can only log a warning or use experimental APIs
      console.warn("GM_setClipboard is partially supported in background.");
      return { success: false, error: 'Not fully implemented in MV3 Background' };
    }
    
    case 'GM_download': {
      const [details] = args; // url, name, headers...
      try {
        const downloadId = await chrome.downloads.download({
          url: details.url,
          filename: details.name,
          conflictAction: 'uniquify'
        });
        return { success: true, data: downloadId };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    default:
      return { success: false, error: 'Unknown Action' };
  }
}

function updateBadge(tabId: number, count: number) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString(), tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#DC2626', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

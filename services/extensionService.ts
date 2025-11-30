import { TabInfo } from '../types';

declare var chrome: any;

const isExtensionEnv = typeof chrome !== 'undefined' && !!chrome.tabs;

/**
 * Get all open tabs
 */
export const getTabs = async (): Promise<TabInfo[]> => {
  if (isExtensionEnv) {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs: any[]) => {
        const tabList = tabs.map(t => ({
          id: t.id,
          title: t.title,
          url: t.url,
          favIconUrl: t.favIconUrl,
          active: t.active
        }));
        resolve(tabList);
      });
    });
  } else {
    // Mock for development in non-extension environment
    return [
      { id: 1, title: 'Google', url: 'https://google.com', active: true, favIconUrl: 'https://www.google.com/favicon.ico' },
      { id: 2, title: 'GitHub', url: 'https://github.com', active: false, favIconUrl: 'https://github.com/favicon.ico' },
      { id: 3, title: 'Stack Overflow', url: 'https://stackoverflow.com', active: false, favIconUrl: 'https://stackoverflow.com/favicon.ico' },
    ];
  }
};

/**
 * Get the currently active tab in the current window
 */
export const getActiveTabInfo = async (): Promise<TabInfo | null> => {
  if (isExtensionEnv) {
    return new Promise((resolve) => {
      // Must use currentWindow: true to get the user's actual focus
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs && tabs.length > 0) {
          const t = tabs[0];
          resolve({
            id: t.id,
            title: t.title,
            url: t.url,
            favIconUrl: t.favIconUrl,
            active: t.active
          });
        } else {
          resolve(null);
        }
      });
    });
  } else {
    // Mock return active tab
    return { id: 1, title: 'Google', url: 'https://google.com', active: true, favIconUrl: 'https://www.google.com/favicon.ico' };
  }
};

/**
 * Activate a specific tab
 */
export const activateTab = (tabId: number) => {
  if (isExtensionEnv) {
    chrome.tabs.update(tabId, { active: true });
  } else {
    console.log(`[Mock] Activated tab ${tabId}`);
  }
};

/**
 * Close a specific tab
 */
export const closeTab = (tabId: number) => {
  if (isExtensionEnv) {
    chrome.tabs.remove(tabId);
  } else {
    console.log(`[Mock] Closed tab ${tabId}`);
  }
};
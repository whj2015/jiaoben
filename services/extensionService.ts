import { TabInfo } from '../types';

declare var chrome: any;

const isExtensionEnv = typeof chrome !== 'undefined' && !!chrome.tabs;

/**
 * Get all open tabs (Used by TabManager UI)
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
    return [
      { id: 1, title: 'Google', url: 'https://google.com', active: true },
    ];
  }
};

/**
 * Get the currently active tab in the current window (Used by ScriptEditor context)
 */
export const getActiveTabInfo = async (): Promise<TabInfo | null> => {
  if (isExtensionEnv) {
    return new Promise((resolve) => {
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
    return { id: 1, title: 'Google', url: 'https://google.com', active: true };
  }
};

export const activateTab = (tabId: number) => {
  if (isExtensionEnv) chrome.tabs.update(tabId, { active: true });
};

export const closeTab = (tabId: number) => {
  if (isExtensionEnv) chrome.tabs.remove(tabId);
};

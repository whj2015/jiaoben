// assets/content.ts
// 运行在 Isolated World，负责在页面脚本(Main World)和后台(Background)之间转发消息

import { GM_XHR_REQUEST, GM_XHR_RESPONSE } from './utils/constants';

interface GMXhrRequestEvent extends CustomEvent {
  detail: {
    requestId: string;
    method?: string;
    url: string;
    headers?: Record<string, string>;
    data?: string;
    binary?: boolean;
  };
}

// GMXhrResponseEvent interface removed as it was unused

console.log('[EdgeGenius] Content Script Loaded');

const handleGMXhrRequest = async (event: Event) => {
  const customEvent = event as GMXhrRequestEvent;
  const { requestId, ...requestDetails } = customEvent.detail;

  try {
    if (!requestDetails.url || typeof requestDetails.url !== 'string') {
      throw new Error('Invalid URL');
    }

    const response = await chrome.runtime.sendMessage({
      type: 'GM_XHR',
      payload: requestDetails
    });

    window.dispatchEvent(new CustomEvent(GM_XHR_RESPONSE, {
      detail: {
        requestId,
        ...response
      }
    }));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Error';
    console.error('[Content] XHR request failed:', error);
    window.dispatchEvent(new CustomEvent(GM_XHR_RESPONSE, {
      detail: {
        requestId,
        error: errorMessage
      }
    }));
  }
};

window.addEventListener(GM_XHR_REQUEST, handleGMXhrRequest);

window.addEventListener('unload', () => {
  window.removeEventListener(GM_XHR_REQUEST, handleGMXhrRequest);
});

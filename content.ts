// assets/content.ts
// 运行在 Isolated World，负责在页面脚本(Main World)和后台(Background)之间转发消息

// 内联常量，避免模块导入问题
const GM_XHR_REQUEST = 'EG_GM_xhr_request';
const GM_XHR_RESPONSE = 'EG_GM_xhr_response';

interface GMXhrRequestMessage {
  type: string;
  requestId: string;
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  binary?: boolean;
}

console.log('[EdgeGenius] Content Script Loaded');

const handleMessage = async (event: MessageEvent) => {
  if (event.source !== window) return;
  if (event.data?.type !== GM_XHR_REQUEST) return;

  const { requestId, ...requestDetails } = event.data as GMXhrRequestMessage;
  const startTime = Date.now();
  
  console.log('[Content] GM_XHR request started:', { 
    requestId, 
    url: requestDetails.url, 
    method: requestDetails.method || 'GET' 
  });

  try {
    if (!requestDetails.url || typeof requestDetails.url !== 'string') {
      throw new Error('Invalid URL');
    }

    const response = await chrome.runtime.sendMessage({
      type: 'GM_XHR',
      payload: requestDetails
    });

    const duration = Date.now() - startTime;
    
    if (response && response.error) {
      console.error(`[Content] GM_XHR request failed (${duration}ms):`, response.error, requestDetails.url);
    } else {
      console.log(`[Content] GM_XHR request completed (${duration}ms):`, { 
        status: response?.status, 
        statusText: response?.statusText,
        responseSize: response?.responseText?.length || 0
      });
    }

    window.postMessage({
      type: GM_XHR_RESPONSE,
      requestId,
      ...response
    }, '*');
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown Error';
    console.error(`[Content] GM_XHR request exception (${duration}ms):`, error, requestDetails.url);
    window.postMessage({
      type: GM_XHR_RESPONSE,
      requestId,
      error: errorMessage,
      status: 0,
      statusText: 'Exception'
    }, '*');
  }
};

window.addEventListener('message', handleMessage);

window.addEventListener('unload', () => {
  window.removeEventListener('message', handleMessage);
});

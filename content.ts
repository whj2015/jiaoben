// assets/content.ts
// 运行在 Isolated World，负责在页面脚本(Main World)和后台(Background)之间转发消息

console.log('[EdgeGenius] Content Script Loaded');

// 监听来自页面脚本(Main World)的请求事件
window.addEventListener('EG_GM_xhr_request', async (event: any) => {
  const { requestId, ...requestDetails } = event.detail;

  try {
    // 转发给后台 (Background) 执行真正的跨域请求
    const response = await chrome.runtime.sendMessage({
      type: 'GM_XHR',
      payload: requestDetails
    });

    // 将后台的响应转回给页面脚本
    window.dispatchEvent(new CustomEvent('EG_GM_xhr_response', {
      detail: {
        requestId,
        ...response
      }
    }));
  } catch (error: any) {
    // 错误处理
    window.dispatchEvent(new CustomEvent('EG_GM_xhr_response', {
      detail: {
        requestId,
        error: error.message || 'Unknown Error'
      }
    }));
  }
});

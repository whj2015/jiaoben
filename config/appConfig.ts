export const APP_CONFIG = {
  APP_NAME: 'EdgeGenius',
  APP_VERSION: '3.2.0',
  
  GITHUB: {
    DEFAULT_REPO_NAME: 'jiaoben-scripts',
    DEFAULT_REPO_DESCRIPTION: 'EdgeGenius 脚本同步仓库',
    API_BASE: 'https://api.github.com',
    USER_AGENT: 'EdgeGenius/3.2.0'
  },

  SCRIPT: {
    MAX_SIZE: 1024 * 1024,
    MAX_NAME_LENGTH: 200,
    MAX_COUNT: 500,
    MAX_HISTORY_VERSIONS: 30,
    VALID_EXTENSIONS: ['.js', '.ts', '.mjs']
  },

  LOG: {
    MAX_PER_SCRIPT: 100,
    MAX_TOTAL: 1000
  },

  SYNC: {
    DEFAULT_CONCURRENCY: 5
  },

  DIFF: {
    LCS_THRESHOLD: 1000,
    CONTEXT_LINES: 3
  },

  AI: {
    MAX_INPUT_LENGTH: 10000,
    MAX_RESPONSE_LENGTH: 65536,
    DEFAULT_TIMEOUT: 120000
  }
} as const;

export const DEFAULT_SCRIPT_TEMPLATE = `// ==UserScript==
// @name         新脚本
// @namespace    https://www.acgline.org/
// @version      0.1
// @description  尝试接管世界！
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('EdgeGenius 脚本正在运行...');
    // 在此处编写代码...
})();`;

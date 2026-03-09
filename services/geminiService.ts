import { GoogleGenAI } from "@google/genai";
import { getStoredApiKey, getStoredDeepSeekKey, getStoredAIProvider, getStoredCustomAIConfig } from "./scriptService";
import { AIProvider, CustomAIConfig } from "../types";

// 常量定义
const MAX_RESPONSE_LENGTH = 100000; // 100KB
const REQUEST_TIMEOUT = 60000; // 60秒
const MAX_INPUT_LENGTH = 10000;
const MIN_API_KEY_LENGTH = 10;
const MAX_OUTPUT_TOKENS = 8192;

// StreamChunk interface removed as it was unused

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new TimeoutError(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

function validateApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false;
  if (apiKey.trim().length < MIN_API_KEY_LENGTH) return false;
  return true;
}

function sanitizeUserInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .substring(0, MAX_INPUT_LENGTH);
}

// escapeHtmlInCode function removed as it was unused

const callGeminiStream = async (
  apiKey: string,
  systemInstruction: string,
  userContent: string,
  onChunk: (text: string) => void
): Promise<void> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = 'gemini-2.5-flash';

    const result = await withTimeout(
      ai.models.generateContentStream({
        model: model,
        contents: userContent,
        config: {
          systemInstruction: systemInstruction,
          maxOutputTokens: MAX_OUTPUT_TOKENS
        }
      }),
      REQUEST_TIMEOUT
    );

    let totalLength = 0;
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        if (totalLength + text.length > MAX_RESPONSE_LENGTH) {
          onChunk(text.substring(0, MAX_RESPONSE_LENGTH - totalLength));
          break;
        }
        onChunk(text);
        totalLength += text.length;
      }
    }
  } catch (error) {
    console.error('[GeminiService] Stream error:', error);
    if (error instanceof TimeoutError) {
      throw new Error('AI request timeout');
    }
    throw error;
  }
};

const callGeminiChatStream = async (
  apiKey: string,
  systemInstruction: string,
  message: string,
  onChunk: (text: string) => void
): Promise<void> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = 'gemini-2.5-flash';

    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: systemInstruction,
        maxOutputTokens: MAX_OUTPUT_TOKENS
      }
    });

    const result = await withTimeout(
      chat.sendMessageStream({ message: message }),
      REQUEST_TIMEOUT
    );

    let totalLength = 0;
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        if (totalLength + text.length > MAX_RESPONSE_LENGTH) {
          onChunk(text.substring(0, MAX_RESPONSE_LENGTH - totalLength));
          break;
        }
        onChunk(text);
        totalLength += text.length;
      }
    }
  } catch (error) {
    console.error('[GeminiService] Chat stream error:', error);
    if (error instanceof TimeoutError) {
      throw new Error('AI request timeout');
    }
    throw error;
  }
};

const callDeepSeekStream = async (
  apiKey: string,
  systemInstruction: string,
  userContent: string | { role: string, content: string }[],
  onChunk: (text: string) => void
): Promise<void> => {
  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    if (typeof userContent === 'string') {
      messages.push({ role: 'user', content: userContent });
    } else if (Array.isArray(userContent)) {
      messages.push(...userContent);
    }

    const response = await withTimeout(
      fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages,
          stream: true,
          max_tokens: 8192
        })
      }),
      REQUEST_TIMEOUT
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API Error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) {
      throw new Error('No response body');
    }

    let totalLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content;
            if (content) {
              if (totalLength + content.length > MAX_RESPONSE_LENGTH) {
                onChunk(content.substring(0, MAX_RESPONSE_LENGTH - totalLength));
                break;
              }
              onChunk(content);
              totalLength += content.length;
            }
          } catch (e) {
          }
        }
      }
    }
  } catch (error) {
    console.error('[DeepSeekService] Stream error:', error);
    if (error instanceof TimeoutError) {
      throw new Error('AI request timeout');
    }
    throw error;
  }
};

const callCustomAIStream = async (
  config: CustomAIConfig,
  systemInstruction: string,
  userContent: string | { role: string, content: string }[],
  onChunk: (text: string) => void
): Promise<void> => {
  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    if (typeof userContent === 'string') {
      messages.push({ role: 'user', content: userContent });
    } else if (Array.isArray(userContent)) {
      messages.push(...userContent);
    }

    let apiUrl = config.apiUrl.trim();
    if (!apiUrl) {
      throw new Error('Custom API URL is not configured');
    }

    const response = await withTimeout(
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-3.5-turbo',
          messages: messages,
          stream: true,
          max_tokens: MAX_OUTPUT_TOKENS
        })
      }),
      REQUEST_TIMEOUT
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Custom API Error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) {
      throw new Error('No response body');
    }

    let totalLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content;
            if (content) {
              if (totalLength + content.length > MAX_RESPONSE_LENGTH) {
                onChunk(content.substring(0, MAX_RESPONSE_LENGTH - totalLength));
                break;
              }
              onChunk(content);
              totalLength += content.length;
            }
          } catch (e) {
          }
        }
      }
    }
  } catch (error) {
    console.error('[CustomAIService] Stream error:', error);
    if (error instanceof TimeoutError) {
      throw new Error('AI request timeout');
    }
    throw error;
  }
};

export const generateScriptWithAI = async (
  requirement: string,
  onChunk: (text: string) => void,
  currentCode?: string,
  contextUrl?: string
): Promise<void> => {
  try {
    const sanitizedRequirement = sanitizeUserInput(requirement);
    if (!sanitizedRequirement) {
      throw new Error('Invalid requirement');
    }

    const provider = await getStoredAIProvider();
    
    let apiKey = '';
    let customConfig: CustomAIConfig | null = null;
    
    if (provider === AIProvider.GOOGLE) {
      apiKey = await getStoredApiKey();
      if (!apiKey) apiKey = process.env.API_KEY || "";
    } else if (provider === AIProvider.DEEPSEEK) {
      apiKey = await getStoredDeepSeekKey();
    } else if (provider === AIProvider.CUSTOM) {
      customConfig = await getStoredCustomAIConfig();
      apiKey = customConfig.apiKey;
    }

    if (provider !== AIProvider.CUSTOM && !validateApiKey(apiKey)) {
      throw new Error("MISSING_API_KEY");
    }
    
    if (provider === AIProvider.CUSTOM && (!customConfig || !customConfig.apiUrl || !customConfig.apiKey)) {
      throw new Error("MISSING_API_KEY");
    }

    let systemPrompt = `你是一位精通 UserScript (Tampermonkey/Violentmonkey) 的 JavaScript 开发专家。
    你的任务是根据用户的需求编写完整、有效的 UserScript。
    
    关键规则：
    1. **元数据**：必须以 // ==UserScript== 代码块开头。
       - 必须设置 @namespace 为 'https://www.acgline.org/'
       - 如果脚本需要发送网络请求，必须添加 @grant GM_xmlhttpRequest
    2. **语言**：**所有的注释和 @description 元数据必须使用中文。**
    3. **纯代码**：仅返回有效的 JavaScript 代码。不要使用 markdown 代码块 (\`\`\`)。
    4. **网络请求 (重要)**：
       - **绝对禁止**使用 fetch() 或 XMLHttpRequest 进行跨域请求，会被 CORS 策略阻止。
       - 必须使用 GM_xmlhttpRequest 进行所有外部网络请求。
       - GM_xmlhttpRequest 用法示例：
         \`\`\`javascript
         GM_xmlhttpRequest({
           method: 'GET',
           url: 'https://api.example.com/data',
           onload: (response) => {
             const data = JSON.parse(response.responseText);
             console.log(data);
           },
           onerror: (error) => {
             console.error('请求失败:', error);
           }
         });
         \`\`\`
       - 如需 Promise 版本，使用 GM.xmlHttpRequest(details) 返回 Promise。
    5. **健壮性**：
       - 现代网站 (SPA, React, Vue) 内容加载是异步的。
       - **绝对不要**假设元素在 'document-end' 时立即存在。
       - 必须使用 'MutationObserver' 或 'setInterval' 等待元素出现后再操作。
       - 始终将逻辑包裹在 try-catch 块中，防止页面崩溃。
    6. **安全性**：将代码包裹在 IIFE (立即调用函数表达式) 中，避免污染全局命名空间。
    `;

    if (contextUrl) {
      systemPrompt += `\n
      上下文感知：
      用户正在浏览：${sanitizeUserInput(contextUrl)}
      - 设置 @match 以匹配此域名 (例如 *://example.com/*)。
      - 针对此网站的结构编写逻辑。
      `;
    } else {
      systemPrompt += `\n根据需求包含智能的 @match 规则。`;
    }

    let userContent = sanitizedRequirement;

    if (currentCode) {
      systemPrompt = `你是一位 UserScript 开发专家。
      你的任务是修改现有的 UserScript 以满足新的需求，同时严格保留现有功能。
      
      更新模式的关键规则：
      1. **禁止回退 (最重要)**：除非与新需求直接冲突，否则**绝对不要**删除或破坏现有的逻辑。当前代码被认为是有效且有价值的。
      2. **增量式方法**：优先添加新函数、变量或事件监听器，而不是重写整个脚本结构。
      3. **命名空间完整性**：确保 @namespace 保持为 'https://www.acgline.org/'。
      4. **元数据保留**：除非明确要求更改，否则保留现有的 @name, @match 和其他元数据。
         - 如果新增网络请求功能，确保添加 @grant GM_xmlhttpRequest
      5. **完整输出**：返回**完整的**更新后脚本代码，而不仅仅是修改部分。
      6. **格式**：仅返回有效的 JavaScript。不要使用 markdown 代码块 (\`\`\`)。
      7. **语言**：**代码中的所有注释和解释必须使用中文。**
      8. **网络请求**：
         - **绝对禁止**使用 fetch() 或 XMLHttpRequest 进行跨域请求。
         - 必须使用 GM_xmlhttpRequest 进行外部网络请求。
      9. **健壮性**：确保新旧逻辑都能优雅地处理动态 DOM 加载 (SPA)。
      10. **版本控制**：分析所做的更改。根据语义化版本控制自动增加元数据块中的 @version 号：
         - **补丁 (Patch)** (例如 0.1.0 -> 0.1.1): 用于错误修复、微调或小调整。
         - **次要 (Minor)** (例如 0.1.0 -> 0.2.0): 用于新功能、新函数或重大逻辑更改。
         - **主要 (Major)** (例如 1.0.0 -> 2.0.0): 用于完全重写或破坏性更改。
      `;

      if (contextUrl) {
        systemPrompt += `\n上下文 URL: ${sanitizeUserInput(contextUrl)} (使用此 URL 验证逻辑是否符合当前站点)`;
      }

      userContent = `原始代码：\n${currentCode}\n\n新需求：\n${sanitizedRequirement}\n\n指令：\n将新需求应用于原始代码，且不丢失现有功能。适当更新 @version。返回完整的更新后代码。`;
    }

    if (provider === AIProvider.GOOGLE) {
      await callGeminiStream(apiKey, systemPrompt, userContent, onChunk);
    } else if (provider === AIProvider.CUSTOM && customConfig) {
      await callCustomAIStream(customConfig, systemPrompt, userContent, onChunk);
    } else {
      await callDeepSeekStream(apiKey, systemPrompt, userContent, onChunk);
    }

  } catch (error) {
    console.error("[AIService] Generation Error:", error);
    throw error;
  }
};

export const streamChatResponse = async (
  message: string,
  onChunk: (text: string) => void
): Promise<void> => {
  try {
    const sanitizedMessage = sanitizeUserInput(message);
    if (!sanitizedMessage) {
      throw new Error('Invalid message');
    }

    const provider = await getStoredAIProvider();
    
    let apiKey = '';
    let customConfig: CustomAIConfig | null = null;
    
    if (provider === AIProvider.GOOGLE) {
      apiKey = await getStoredApiKey();
      if (!apiKey) apiKey = process.env.API_KEY || "";
    } else if (provider === AIProvider.DEEPSEEK) {
      apiKey = await getStoredDeepSeekKey();
    } else if (provider === AIProvider.CUSTOM) {
      customConfig = await getStoredCustomAIConfig();
      apiKey = customConfig.apiKey;
    }

    if (provider !== AIProvider.CUSTOM && !validateApiKey(apiKey)) {
      throw new Error("MISSING_API_KEY");
    }
    
    if (provider === AIProvider.CUSTOM && (!customConfig || !customConfig.apiUrl || !customConfig.apiKey)) {
      throw new Error("MISSING_API_KEY");
    }

    const systemInstruction = "你是一个浏览器扩展管理器中的智能 AI 助手。请使用中文协助用户完成网页浏览任务、总结内容、解释脚本代码或回答技术问题。";

    if (provider === AIProvider.GOOGLE) {
      await callGeminiChatStream(apiKey, systemInstruction, sanitizedMessage, onChunk);
    } else if (provider === AIProvider.CUSTOM && customConfig) {
      await callCustomAIStream(customConfig, systemInstruction, sanitizedMessage, onChunk);
    } else {
      await callDeepSeekStream(apiKey, systemInstruction, sanitizedMessage, onChunk);
    }

  } catch (error) {
    console.error("[AIService] Chat Error:", error);
    throw error;
  }
};

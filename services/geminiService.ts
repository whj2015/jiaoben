import { GoogleGenAI } from "@google/genai";
import { getStoredApiKey, getStoredDeepSeekKey, getStoredAIProvider } from "./scriptService";
import { AIProvider } from "../types";

// --- Helper to clean markdown ---
export const cleanMarkdown = (text: string): string => {
  return text.replace(/^```javascript\s*/i, '')
             .replace(/^```\s*/i, '')
             .replace(/```$/i, '')
             .trim();
};

// --- Google Gemini Implementation ---
const callGeminiStream = async (
  apiKey: string,
  systemInstruction: string,
  userContent: string,
  onChunk: (text: string) => void
) => {
  const ai = new GoogleGenAI({ apiKey: apiKey });
  const model = 'gemini-2.5-flash';

  const result = await ai.models.generateContentStream({
    model: model,
    contents: userContent,
    config: {
      systemInstruction: systemInstruction,
    }
  });

  for await (const chunk of result) {
    const text = chunk.text;
    if (text) {
      onChunk(text);
    }
  }
};

const callGeminiChatStream = async (
  apiKey: string,
  systemInstruction: string,
  message: string,
  onChunk: (text: string) => void
) => {
  const ai = new GoogleGenAI({ apiKey: apiKey });
  const model = 'gemini-2.5-flash';

  const chat = ai.chats.create({
    model: model,
    config: {
      systemInstruction: systemInstruction,
    }
  });

  const result = await chat.sendMessageStream({ message: message });

  for await (const chunk of result) {
    const text = chunk.text;
    if (text) {
      onChunk(text);
    }
  }
};

// --- DeepSeek Implementation (OpenAI Compatible) ---
const callDeepSeekStream = async (
  apiKey: string,
  systemInstruction: string,
  userContent: string | { role: string, content: string }[],
  onChunk: (text: string) => void
) => {
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  if (typeof userContent === 'string') {
    messages.push({ role: 'user', content: userContent });
  } else if (Array.isArray(userContent)) {
    messages.push(...userContent);
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      stream: true
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API Error: ${response.status} ${response.statusText} - ${errText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content;
          if (content) onChunk(content);
        } catch (e) {
          // ignore invalid json or incomplete chunks
        }
      }
    }
  }
};

// --- Main Service Functions ---

export const generateScriptWithAI = async (
  requirement: string,
  onChunk: (text: string) => void,
  currentCode?: string,
  contextUrl?: string
) => {
  try {
    const provider = await getStoredAIProvider();
    
    let apiKey = '';
    if (provider === AIProvider.GOOGLE) {
      apiKey = await getStoredApiKey();
      if (!apiKey) apiKey = process.env.API_KEY || "";
    } else if (provider === AIProvider.DEEPSEEK) {
      apiKey = await getStoredDeepSeekKey();
    }

    if (!apiKey) throw new Error("MISSING_API_KEY");

    let systemPrompt = `You are an expert JavaScript developer specializing in UserScripts (Tampermonkey/Violentmonkey).
    Your task is to write a complete, valid UserScript based on the user's requirement.
    
    CRITICAL RULES:
    1. **Metadata**: Start with // ==UserScript== block.
    2. **Raw Code**: Return ONLY valid JavaScript. Do NOT use markdown code blocks (\`\`\`). Do NOT wrap the code in markdown.
    3. **Robustness**: 
       - Modern websites (SPA, React, Vue) load content asynchronously. 
       - You MUST NOT assume elements exist immediately on 'document-end'.
       - Use 'MutationObserver' or 'setInterval' to wait for elements to appear before acting.
       - Always wrap your logic in try-catch blocks to prevent crashing the page.
    4. **Safety**: Wrap your code in an IIFE (Immediately Invoked Function Expression) to avoid global namespace pollution.
    `;

    if (contextUrl) {
      systemPrompt += `\n
      CONTEXT AWARENESS:
      The user is browsing: ${contextUrl}
      - Set @match to target this domain (e.g., *://example.com/*).
      - Write logic specifically for this site's structure.
      `;
    } else {
      systemPrompt += `\nInclude smart @match rules based on the requirement.`;
    }

    let userContent = requirement;

    // 如果提供了现有代码，切换为更新模式
    if (currentCode) {
      systemPrompt = `You are an expert UserScript developer.
      Your task is to UPDATE or REFACTOR an existing UserScript based on the user's new requirement.
      
      Rules:
      1. Keep the existing metadata unless the requirement specifically changes it.
      2. Preserve existing functionality if it doesn't conflict with the new requirement.
      3. Return the FULL updated script code (not just the diff).
      4. Do NOT use markdown code blocks (\`\`\`). Do NOT wrap in markdown.
      5. Ensure the code handles dynamic DOM loading (SPAs) gracefully.
      `;

      if (contextUrl) {
        systemPrompt += `\nContext URL: ${contextUrl} (Use this to verify logic against current site)`;
      }

      userContent = `Current Code:\n${currentCode}\n\nNew Requirement/Change:\n${requirement}`;
    }

    if (provider === AIProvider.GOOGLE) {
      await callGeminiStream(apiKey, systemPrompt, userContent, onChunk);
    } else {
      await callDeepSeekStream(apiKey, systemPrompt, userContent, onChunk);
    }

  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
};

export const streamChatResponse = async (
  message: string,
  onChunk: (text: string) => void
) => {
  try {
    const provider = await getStoredAIProvider();
    
    let apiKey = '';
    if (provider === AIProvider.GOOGLE) {
      apiKey = await getStoredApiKey();
      if (!apiKey) apiKey = process.env.API_KEY || "";
    } else if (provider === AIProvider.DEEPSEEK) {
      apiKey = await getStoredDeepSeekKey();
    }

    if (!apiKey) throw new Error("MISSING_API_KEY");

    const systemInstruction = "You are a helpful AI assistant inside a browser extension manager. Help the user with web browsing tasks, summarizing content, or explaining scripts.";

    if (provider === AIProvider.GOOGLE) {
      await callGeminiChatStream(apiKey, systemInstruction, message, onChunk);
    } else {
      // DeepSeek simple chat stream
      await callDeepSeekStream(apiKey, systemInstruction, message, onChunk);
    }

  } catch (error) {
    console.error("AI Chat Error:", error);
    throw error;
  }
};
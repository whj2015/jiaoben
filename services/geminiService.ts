import { GoogleGenAI } from "@google/genai";
import { getStoredApiKey, getStoredDeepSeekKey, getStoredAIProvider } from "./scriptService";
import { AIProvider } from "../types";

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
    
    Rules:
    1. Start with the metadata block // ==UserScript== ... // ==/UserScript==
    2. Write clean, ES6+ JavaScript code.
    3. Do not wrap the code in markdown blocks (like \`\`\`javascript), just return the raw code.
    4. Add comments explaining key logic.
    `;

    if (contextUrl) {
      systemPrompt += `\n
      CONTEXT AWARENESS:
      The user is currently browsing: ${contextUrl}
      Unless the user explicitly asks for a global script, you MUST set the @match rule to target this domain (e.g., *://example.com/*).
      Optimize the script for this specific site's DOM structure if implied by the request.
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
      4. Do not wrap the code in markdown blocks.
      `;

      if (contextUrl) {
        systemPrompt += `\nContext URL: ${contextUrl} (Use this if you need to verify logic against the current site)`;
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
      // DeepSeek doesn't have a specific 'chat' object like Google GenAI SDK, so we treat it as a fresh stream with history managed by client if needed. 
      // For this simple assistant, we are currently only passing the last user message in the 'message' arg.
      // To properly support chat history with DeepSeek in this architecture, we would need to pass the full history. 
      // For now, we will just send the single message to keep it simple, or improved later.
      // NOTE: The previous Google implementation also only sent `message` without history context in `sendMessageStream` unless `chat` object persisted.
      // Since `streamGeminiResponse` created a new `chat` instance every time, it didn't strictly maintain history either in the Service layer (though the UI does).
      // We will emulate the same "stateless" behavior for now.
      await callDeepSeekStream(apiKey, systemInstruction, message, onChunk);
    }

  } catch (error) {
    console.error("AI Chat Error:", error);
    throw error;
  }
};
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
    
    CRITICAL RULES:
    1. **Metadata**: Start with // ==UserScript== block.
       - Always set @namespace to 'https://www.acgline.org/'
    2. **Raw Code**: Return ONLY valid JavaScript. Do NOT use markdown code blocks (\`\`\`).
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
      Your task is to MODIFY an existing UserScript to satisfy a new requirement while STRICTLY PRESERVING existing functionality.
      
      CRITICAL RULES for UPDATE MODE:
      1. **NO REGRESSION (Most Important)**: Do NOT remove or break any existing logic unless it directly conflicts with the new requirement. The current code is considered working and valuable.
      2. **Additive Approach**: Prefer adding new functions, variables, or event listeners over rewriting the entire script structure.
      3. **Namespace Integrity**: Ensure @namespace remains 'https://www.acgline.org/'.
      4. **Metadata Preservation**: Keep existing @name, @match, and other metadata unless explicitly asked to change them.
      5. **Full Output**: Return the COMPLETE updated script code, not just the changes.
      6. **Format**: Return ONLY valid JavaScript. NO markdown code blocks (\`\`\`).
      7. **Robustness**: Ensure both old and new logic handles dynamic DOM loading (SPAs) gracefully.
      8. **Version Control**: Analyze the changes made. AUTOMATICALLY increment the @version number in the metadata block based on Semantic Versioning:
         - **Patch** (e.g., 0.1.0 -> 0.1.1): for bug fixes, tweaks, or small adjustments.
         - **Minor** (e.g., 0.1.0 -> 0.2.0): for new features, new functions, or significant logic changes.
         - **Major** (e.g., 1.0.0 -> 2.0.0): for complete rewrites or breaking changes.
      `;

      if (contextUrl) {
        systemPrompt += `\nContext URL: ${contextUrl} (Use this to verify logic against current site)`;
      }

      userContent = `ORIGINAL CODE:\n${currentCode}\n\nNEW REQUIREMENT:\n${requirement}\n\nINSTRUCTION:\nApply the new requirement to the ORIGINAL CODE without losing existing features. Update the @version appropriately. Return the full updated code.`;
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
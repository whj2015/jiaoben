import { GoogleGenAI } from "@google/genai";
import { getStoredApiKey } from "./scriptService";

export const generateScriptWithAI = async (
  requirement: string,
  onChunk: (text: string) => void,
  currentCode?: string,
  contextUrl?: string
) => {
  try {
    let apiKey = await getStoredApiKey();
    if (!apiKey) apiKey = process.env.API_KEY || "";
    if (!apiKey) throw new Error("MISSING_API_KEY");

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = 'gemini-2.5-flash'; 

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
    
    const result = await ai.models.generateContentStream({
      model: model,
      contents: userContent,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        onChunk(text);
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const streamGeminiResponse = async (
  message: string,
  onChunk: (text: string) => void
) => {
  try {
    let apiKey = await getStoredApiKey();
    if (!apiKey) apiKey = process.env.API_KEY || "";
    if (!apiKey) throw new Error("MISSING_API_KEY");

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = 'gemini-2.5-flash';

    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: "You are a helpful AI assistant inside a browser extension manager. Help the user with web browsing tasks, summarizing content, or explaining scripts.",
      }
    });

    const result = await chat.sendMessageStream({ message: message });

    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        onChunk(text);
      }
    }
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};
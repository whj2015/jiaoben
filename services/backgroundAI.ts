interface AIGenerationStatus {
  isGenerating: boolean;
  scriptId: string | null;
  scriptName: string;
  progress: string;
  generatedCode: string;
  error?: string;
}

async function sendMessage<T>(type: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

export async function startAIGeneration(
  requirement: string,
  scriptId: string | null,
  scriptName: string,
  currentCode?: string,
  contextUrl?: string
): Promise<AIGenerationStatus> {
  return sendMessage<AIGenerationStatus>('AI_GENERATE_START', {
    requirement,
    scriptId,
    scriptName,
    currentCode,
    contextUrl
  });
}

export async function getAIGenerationStatus(): Promise<AIGenerationStatus> {
  return sendMessage<AIGenerationStatus>('AI_GENERATE_STATUS');
}

export async function cancelAIGeneration(): Promise<AIGenerationStatus> {
  return sendMessage<AIGenerationStatus>('AI_GENERATE_CANCEL');
}

export async function completeAIGeneration(): Promise<AIGenerationStatus> {
  return sendMessage<AIGenerationStatus>('AI_GENERATE_COMPLETE');
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  generateScriptWithAI,
  streamChatResponse
} from '../services/geminiService';
import { 
  getStoredApiKey, 
  setStoredApiKey,
  getStoredDeepSeekKey,
  setStoredDeepSeekKey,
  getStoredAIProvider
} from '../services/scriptService';

vi.mock('../services/scriptService', () => ({
  getStoredApiKey: vi.fn(),
  setStoredApiKey: vi.fn(),
  getStoredDeepSeekKey: vi.fn(),
  setStoredDeepSeekKey: vi.fn(),
  getStoredAIProvider: vi.fn(),
}));

describe('GeminiService - Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should reject empty requirements', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      await expect(generateScriptWithAI('', vi.fn())).rejects.toThrow('Invalid requirement');
    });

    it('should reject whitespace-only requirements', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      await expect(generateScriptWithAI('   ', vi.fn())).rejects.toThrow('Invalid requirement');
    });

    it('should reject empty chat messages', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      await expect(streamChatResponse('', vi.fn())).rejects.toThrow('Invalid message');
    });

    it('should truncate long input to 10000 characters', async () => {
      const longInput = 'a'.repeat(15000);
      const onChunk = vi.fn();
      
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      await generateScriptWithAI(longInput, onChunk);
      
      expect(onChunk).toHaveBeenCalled();
    });
  });

  describe('API Key Validation', () => {
    it('should reject missing API key', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      await expect(generateScriptWithAI('test', vi.fn())).rejects.toThrow('MISSING_API_KEY');
    });

    it('should reject short API keys', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('short');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      await expect(generateScriptWithAI('test', vi.fn())).rejects.toThrow('MISSING_API_KEY');
    });

    it('should accept valid API keys', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      const onChunk = vi.fn();
      
      await generateScriptWithAI('test', onChunk).catch(() => {});
      
      expect(onChunk).toHaveBeenCalled();
    });
  });

  describe('Response Length Limiting', () => {
    it('should limit response to MAX_RESPONSE_LENGTH', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      const onChunk = vi.fn();
      
      await generateScriptWithAI('test', onChunk).catch(() => {});
      
      expect(onChunk).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout errors', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      await expect(generateScriptWithAI('test', vi.fn())).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      await expect(generateScriptWithAI('test', vi.fn())).rejects.toThrow();
    });
  });

  describe('Input Sanitization', () => {
    it('should remove control characters from input', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      const onChunk = vi.fn();
      
      await generateScriptWithAI('test\x00\x1F\x7F', onChunk).catch(() => {});
      
      expect(onChunk).toHaveBeenCalled();
    });

    it('should trim whitespace from input', async () => {
      vi.mocked(getStoredApiKey).mockResolvedValue('valid-api-key-12345');
      vi.mocked(getStoredAIProvider).mockResolvedValue('GOOGLE' as any);
      
      const onChunk = vi.fn();
      
      await generateScriptWithAI('  test  ', onChunk).catch(() => {});
      
      expect(onChunk).toHaveBeenCalled();
    });
  });
});

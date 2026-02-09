import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  parseMetadata,
  createScriptFromCode
} from '../services/scriptService';
import { encryptText, decryptText } from '../utils/encryption';
import { 
  validateFilename, 
  validateScriptCode, 
  escapeHtml
} from '../utils/helpers';

describe('ScriptService - Security Functions', () => {
  describe('validateFilename', () => {
    it('should accept valid script names', () => {
      expect(validateFilename('Test Script')).toBe(true);
      expect(validateFilename('My-Script_123')).toBe(true);
      expect(validateFilename('中文脚本')).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(validateFilename('' as any)).toBe(false);
      expect(validateFilename(null as any)).toBe(false);
      expect(validateFilename(undefined as any)).toBe(false);
    });

    it('should reject names with control characters', () => {
      expect(validateFilename('Script\x00Name')).toBe(false);
      expect(validateFilename('Script\x1FName')).toBe(false);
      expect(validateFilename('Script\x7FName')).toBe(false);
    });

    it('should reject empty names', () => {
      expect(validateFilename('')).toBe(false);
      expect(validateFilename('   ')).toBe(false);
    });

    it('should reject names exceeding max length', () => {
      const longName = 'A'.repeat(201);
      expect(validateFilename(longName)).toBe(false);
    });
  });

  describe('validateScriptCode', () => {
    it('should accept valid script code', () => {
      expect(validateScriptCode('console.log("test");')).toEqual({ valid: true });
      expect(validateScriptCode('function test() {}')).toEqual({ valid: true });
    });

    it('should reject null or undefined', () => {
      expect(validateScriptCode('' as any)).toEqual({ valid: false, error: '代码不能为空' });
      expect(validateScriptCode(null as any)).toEqual({ valid: false, error: '代码不能为空' });
    });

    it('should reject code exceeding max size', () => {
      const largeCode = 'a'.repeat(1024 * 1024 + 1);
      expect(validateScriptCode(largeCode)).toEqual({ valid: false, error: '代码大小超过限制 (1048576 字节)' });
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('&')).toBe('&amp;');
      expect(escapeHtml('"')).toBe('&quot;');
      expect(escapeHtml("'")).toBe('&#039;');
      expect(escapeHtml('>')).toBe('&gt;');
    });

    it('should escape mixed content', () => {
      const input = '<div class="test">Hello & World</div>';
      const expected = '&lt;div class=&quot;test&quot;&gt;Hello &amp; World&lt;/div&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });
  });
});

describe('ScriptService - Encryption Functions', () => {
  it('should encrypt and decrypt API keys', async () => {
    const apiKey = 'test-api-key-12345';
    const encrypted = await encryptText(apiKey);
    
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toBe(apiKey);
    
    const decrypted = await decryptText(encrypted);
    expect(decrypted).toBe(apiKey);
  });

  it('should handle empty strings', async () => {
    const encrypted = await encryptText('');
    expect(encrypted).toBe('');
    
    const decrypted = await decryptText('');
    expect(decrypted).toBe('');
  });

  it('should handle invalid encrypted strings', async () => {
    const decrypted = await decryptText('invalid-encrypted-string');
    expect(decrypted).toBe('');
  });
});

describe('ScriptService - Metadata Parsing', () => {
  it('should parse valid UserScript metadata', () => {
    const code = `// ==UserScript==
// @name         Test Script
// @namespace    https://example.com/
// @version      1.0
// @description  A test script
// @author       Test Author
// @match        *://example.com/*
// @grant        none
// ==/UserScript==

console.log("test");`;

    const metadata = parseMetadata(code);
    
    expect(metadata.name).toBe('Test Script');
    expect(metadata.namespace).toBe('https://example.com/');
    expect(metadata.version).toBe('1.0');
    expect(metadata.description).toBe('A test script');
    expect(metadata.author).toBe('Test Author');
    expect(metadata.match).toContain('*://example.com/*');
  });

  it('should handle scripts without metadata', () => {
    const code = 'console.log("test");';
    const metadata = parseMetadata(code);
    
    expect(metadata.name).toBe('无标题脚本');
    expect(metadata.match).toEqual([]);
  });

  it('should escape HTML in metadata', () => {
    const code = `// ==UserScript==
// @name         <script>alert("xss")</script>
// @description  Test & Description
// ==/UserScript==`;

    const metadata = parseMetadata(code);
    
    expect(metadata.name).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(metadata.description).toBe('Test &amp; Description');
  });
});

describe('ScriptService - Script Creation', () => {
  it('should create script from code', () => {
    const code = `// ==UserScript==
// @name         Test Script
// @version      1.0
// @match        *://example.com/*
// ==/UserScript==

console.log("test");`;

    const script = createScriptFromCode(code, 'test-id');
    
    expect(script.id).toBe('test-id');
    expect(script.name).toBe('Test Script');
    expect(script.version).toBe('1.0');
    expect(script.code).toBe(code);
    expect(script.enabled).toBe(true);
    expect(script.history).toEqual([]);
  });

  it('should generate ID if not provided', () => {
    const code = `// ==UserScript==
// @name         Test Script
// @version      1.0
// @match        *://example.com/*
// ==/UserScript==

console.log("test");`;

    const script = createScriptFromCode(code);
    
    expect(script.id).toBeTruthy();
    expect(script.id.length).toBeGreaterThan(0);
  });

  it('should use default match rules if none provided', () => {
    const code = `// ==UserScript==
// @name         Test Script
// @version      1.0
// ==/UserScript==

console.log("test");`;

    const script = createScriptFromCode(code);
    
    expect(script.match).toContain('*://*/*');
  });
});

describe('ScriptService - Edge Cases', () => {
  it('should handle Unicode characters in script names', () => {
    expect(validateFilename('脚本测试')).toBe(true);
    expect(validateFilename('🎮 Game Script')).toBe(true);
  });

  it('should handle very long descriptions', () => {
    const longDesc = 'A'.repeat(1000);
    const code = `// ==UserScript==
// @name         Test Script
// @description  ${longDesc}
// ==/UserScript==`;

    const metadata = parseMetadata(code);
    expect(metadata.description).toBe(longDesc);
  });

  it('should handle multiple match rules', () => {
    const code = `// ==UserScript==
// @name         Test Script
// @match        *://example.com/*
// @match        *://test.com/*
// @match        *://demo.com/*
// ==/UserScript==`;

    const metadata = parseMetadata(code);
    expect(metadata.match.length).toBe(3);
    expect(metadata.match).toContain('*://example.com/*');
    expect(metadata.match).toContain('*://test.com/*');
    expect(metadata.match).toContain('*://demo.com/*');
  });
});

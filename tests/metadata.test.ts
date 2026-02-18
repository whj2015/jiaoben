import { describe, it, expect } from 'vitest';
import { parseScriptMetadata, hasValidMetadata, extractScriptName } from '../utils/metadata';

describe('metadata utils', () => {
  describe('parseScriptMetadata', () => {
    it('should parse basic metadata', () => {
      const code = `// ==UserScript==
// @name Test Script
// @version 1.0
// @description A test script
// @match https://example.com/*
// ==/UserScript==
console.log('hello');`;

      const metadata = parseScriptMetadata(code);
      
      expect(metadata.name).toBe('Test Script');
      expect(metadata.version).toBe('1.0');
      expect(metadata.description).toBe('A test script');
      expect(metadata.match).toContain('https://example.com/*');
    });

    it('should handle missing metadata block', () => {
      const code = `console.log('no metadata');`;
      const metadata = parseScriptMetadata(code);
      
      expect(metadata.name).toBe('无标题脚本');
      expect(metadata.match).toEqual([]);
    });

    it('should parse multiple match patterns', () => {
      const code = `// ==UserScript==
// @name Multi Match
// @match https://site1.com/*
// @match https://site2.com/*
// @exclude https://site1.com/admin/*
// ==/UserScript==`;

      const metadata = parseScriptMetadata(code);
      
      expect(metadata.match).toHaveLength(2);
      expect(metadata.exclude).toHaveLength(1);
    });

    it('should escape HTML in metadata', () => {
      const code = `// ==UserScript==
// @name <script>alert('xss')</script>
// @description <b>bold</b>
// ==/UserScript==`;

      const metadata = parseScriptMetadata(code);
      
      expect(metadata.name).not.toContain('<script>');
      expect(metadata.description).not.toContain('<b>');
    });
  });

  describe('hasValidMetadata', () => {
    it('should return true for valid metadata', () => {
      const code = `// ==UserScript==
// @name Test
// ==/UserScript==`;
      
      expect(hasValidMetadata(code)).toBe(true);
    });

    it('should return false for missing metadata', () => {
      const code = `console.log('test');`;
      
      expect(hasValidMetadata(code)).toBe(false);
    });
  });

  describe('extractScriptName', () => {
    it('should extract script name', () => {
      const code = `// ==UserScript==
// @name My Script
// ==/UserScript==`;
      
      expect(extractScriptName(code)).toBe('My Script');
    });

    it('should return default name for missing metadata', () => {
      const code = `console.log('test');`;
      
      expect(extractScriptName(code)).toBe('无标题脚本');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../utils/helpers';

describe('Component Security Tests', () => {
  describe('XSS Prevention', () => {
    it('should escape script tags', () => {
      const malicious = '<script>alert("xss")</script>';
      const escaped = escapeHtml(malicious);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
  });

  describe('HTML Entity Escaping', () => {
    it('should escape all HTML special characters', () => {
      const input = '<div class="test">&"\'</div>';
      const expected = '&lt;div class=&quot;test&quot;&gt;&amp;&quot;&#039;&lt;/div&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle ampersand correctly', () => {
      const input = 'AT&T & Company';
      const expected = 'AT&amp;T &amp; Company';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle quotes correctly', () => {
      const input = 'He said "Hello" and \'Goodbye\'';
      const expected = 'He said &quot;Hello&quot; and &#039;Goodbye&#039;';
      expect(escapeHtml(input)).toBe(expected);
    });
  });

  describe('Unicode and Special Characters', () => {
    it('should preserve Unicode characters', () => {
      const input = '中文测试 🎮 日本語 Español';
      expect(escapeHtml(input)).toBe(input);
    });

    it('should handle emoji', () => {
      const input = '😀 😎 🚀';
      expect(escapeHtml(input)).toBe(input);
    });

    it('should handle mixed content', () => {
      const input = 'Test <b>bold</b> and 中文 🎮';
      const expected = 'Test &lt;b&gt;bold&lt;/b&gt; and 中文 🎮';
      expect(escapeHtml(input)).toBe(expected);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle strings with only special characters', () => {
      const input = '<>&"\'';
      const expected = '&lt;&gt;&amp;&quot;&#039;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle multiple consecutive special characters', () => {
      const input = '<<<>>>&&&""\'\'';
      const escaped = escapeHtml(input);
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
      expect(escaped).not.toContain('"');
      expect(escaped).not.toContain("'");
      expect(escaped).toContain('&lt;');
      expect(escaped).toContain('&gt;');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&quot;');
      expect(escaped).toContain('&#039;');
    });
  });
});

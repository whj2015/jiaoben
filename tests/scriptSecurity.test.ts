import { describe, it, expect } from 'vitest';
import { 
  analyzeScriptPermissions, 
  getSecurityWarning, 
  extractExternalDomains,
  generateSecurityReport 
} from '../utils/scriptSecurity';

describe('scriptSecurity', () => {
  describe('analyzeScriptPermissions', () => {
    it('should detect eval usage', () => {
      const code = `eval('dangerous code');`;
      const permissions = analyzeScriptPermissions(code);
      
      expect(permissions.some(p => p.type === 'unsafe' && p.description.includes('eval'))).toBe(true);
      expect(permissions.some(p => p.level === 'danger')).toBe(true);
    });

    it('should detect fetch requests', () => {
      const code = `fetch('https://api.example.com/data');`;
      const permissions = analyzeScriptPermissions(code);
      
      expect(permissions.some(p => p.type === 'network')).toBe(true);
    });

    it('should detect cookie access', () => {
      const code = `const cookies = document.cookie;`;
      const permissions = analyzeScriptPermissions(code);
      
      expect(permissions.some(p => p.type === 'cookies')).toBe(true);
    });

    it('should detect localStorage usage', () => {
      const code = `localStorage.setItem('key', 'value');`;
      const permissions = analyzeScriptPermissions(code);
      
      expect(permissions.some(p => p.type === 'storage')).toBe(true);
    });

    it('should detect innerHTML assignment', () => {
      const code = `element.innerHTML = '<script>alert(1)</script>';`;
      const permissions = analyzeScriptPermissions(code);
      
      expect(permissions.some(p => p.description.includes('innerHTML'))).toBe(true);
    });

    it('should return empty array for safe code', () => {
      const code = `console.log('Hello, World!');`;
      const permissions = analyzeScriptPermissions(code);
      
      expect(permissions).toHaveLength(0);
    });

    it('should detect multiple permissions', () => {
      const code = `
        eval('code');
        fetch('https://api.example.com');
        localStorage.setItem('key', 'value');
      `;
      const permissions = analyzeScriptPermissions(code);
      
      expect(permissions.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getSecurityWarning', () => {
    it('should return danger warning for dangerous permissions', () => {
      const permissions = [
        { type: 'unsafe' as const, level: 'danger' as const, description: 'eval usage' }
      ];
      
      const warning = getSecurityWarning(permissions);
      
      expect(warning).toContain('危险');
    });

    it('should return warning for warning-level permissions', () => {
      const permissions = [
        { type: 'network' as const, level: 'warning' as const, description: 'network requests' }
      ];
      
      const warning = getSecurityWarning(permissions);
      
      expect(warning).not.toBeNull();
    });

    it('should return null for safe permissions', () => {
      const permissions: never[] = [];
      
      const warning = getSecurityWarning(permissions);
      
      expect(warning).toBeNull();
    });
  });

  describe('extractExternalDomains', () => {
    it('should extract domains from URLs', () => {
      const code = `
        fetch('https://api.example.com/data');
        fetch('https://cdn.another-site.org/script.js');
      `;
      
      const domains = extractExternalDomains(code);
      
      expect(domains).toContain('api.example.com');
      expect(domains).toContain('cdn.another-site.org');
    });

    it('should return empty array for no URLs', () => {
      const code = `console.log('no urls here');`;
      
      const domains = extractExternalDomains(code);
      
      expect(domains).toHaveLength(0);
    });

    it('should deduplicate domains', () => {
      const code = `
        fetch('https://api.example.com/1');
        fetch('https://api.example.com/2');
      `;
      
      const domains = extractExternalDomains(code);
      
      expect(domains.filter(d => d === 'api.example.com')).toHaveLength(1);
    });
  });

  describe('generateSecurityReport', () => {
    it('should generate complete security report', () => {
      const code = `// ==UserScript==
// @name Test
// ==/UserScript==
eval('code');
fetch('https://api.example.com/data');
`;
      
      const report = generateSecurityReport(code);
      
      expect(report.externalDomains).toContain('api.example.com');
      expect(report.riskLevel).toBe('high');
    });

    it('should return low risk for safe code', () => {
      const code = `console.log('safe');`;
      
      const report = generateSecurityReport(code);
      
      expect(report.riskLevel).toBe('low');
      expect(report.permissions).toHaveLength(0);
    });
  });
});

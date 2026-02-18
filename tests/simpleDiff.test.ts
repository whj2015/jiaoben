import { describe, it, expect } from 'vitest';
import { diffLines, getDiffStats, processDiffWithContext } from '../utils/simpleDiff';

describe('simpleDiff', () => {
  describe('diffLines', () => {
    it('should detect added lines', () => {
      const text1 = 'line1\nline2';
      const text2 = 'line1\nline2\nline3';
      
      const diff = diffLines(text1, text2);
      
      const addedLine = diff.find(d => d.added);
      expect(addedLine).toBeDefined();
      expect(addedLine?.value).toBe('line3');
    });

    it('should detect removed lines', () => {
      const text1 = 'line1\nline2\nline3';
      const text2 = 'line1\nline2';
      
      const diff = diffLines(text1, text2);
      
      const removedLine = diff.find(d => d.removed);
      expect(removedLine).toBeDefined();
      expect(removedLine?.value).toBe('line3');
    });

    it('should detect modified lines', () => {
      const text1 = 'line1\nold\nline3';
      const text2 = 'line1\nnew\nline3';
      
      const diff = diffLines(text1, text2);
      
      const removedLine = diff.find(d => d.removed);
      const addedLine = diff.find(d => d.added);
      
      expect(removedLine?.value).toBe('old');
      expect(addedLine?.value).toBe('new');
    });

    it('should handle identical texts', () => {
      const text = 'line1\nline2\nline3';
      
      const diff = diffLines(text, text);
      
      expect(diff.every(d => !d.added && !d.removed)).toBe(true);
    });

    it('should handle empty texts', () => {
      const diff1 = diffLines('', 'new line');
      expect(diff1.some(d => d.added)).toBe(true);

      const diff2 = diffLines('old line', '');
      expect(diff2.some(d => d.removed)).toBe(true);

      const diff3 = diffLines('', '');
      expect(diff3).toHaveLength(0);
    });

    it('should handle large files efficiently', () => {
      const lines1 = Array(2000).fill(null).map((_, i) => `line ${i}`);
      const lines2 = [...lines1.slice(0, 1000), 'inserted line', ...lines1.slice(1000)];
      
      const text1 = lines1.join('\n');
      const text2 = lines2.join('\n');
      
      const start = performance.now();
      const diff = diffLines(text1, text2);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(1000);
      expect(diff.some(d => d.added)).toBe(true);
    });
  });

  describe('getDiffStats', () => {
    it('should count added, removed, and unchanged lines', () => {
      const diff = [
        { value: 'line1' },
        { value: 'line2' },
        { value: 'old', removed: true },
        { value: 'new', added: true },
        { value: 'line3' }
      ];
      
      const stats = getDiffStats(diff);
      
      expect(stats.added).toBe(1);
      expect(stats.removed).toBe(1);
      expect(stats.unchanged).toBe(3);
    });
  });

  describe('processDiffWithContext', () => {
    it('should collapse long unchanged sections', () => {
      const diff = [
        { value: 'context1' },
        { value: 'context2' },
        { value: 'context3' },
        { value: 'context4' },
        { value: 'context5' },
        { value: 'context6' },
        { value: 'context7' },
        { value: 'changed', added: true },
        { value: 'context8' },
        { value: 'context9' },
        { value: 'context10' }
      ];
      
      const blocks = processDiffWithContext(diff, 2);
      
      expect(blocks.some(b => b.type === 'collapsed')).toBe(true);
    });

    it('should not collapse short unchanged sections', () => {
      const diff = [
        { value: 'line1' },
        { value: 'line2' },
        { value: 'changed', added: true },
        { value: 'line3' }
      ];
      
      const blocks = processDiffWithContext(diff, 2);
      
      expect(blocks.every(b => b.type === 'diff')).toBe(true);
    });
  });
});

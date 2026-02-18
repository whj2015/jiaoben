export interface DiffLine {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface ProcessedDiffBlock {
  type: 'diff' | 'collapsed';
  lines: DiffLine[];
}

function myersDiff(a: string[], b: string[]): Array<{ op: 'equal' | 'delete' | 'insert'; value: string }> {
  const n = a.length;
  const m = b.length;
  
  if (n === 0 && m === 0) return [];
  if (n === 0) return b.map(line => ({ op: 'insert' as const, value: line }));
  if (m === 0) return a.map(line => ({ op: 'delete' as const, value: line }));

  const max = n + m;
  const v: number[] = new Array(2 * max + 1);
  const trace: number[][] = [];
  
  v[max + 1] = 0;
  
  for (let d = 0; d <= max; d++) {
    trace.push([...v]);
    
    for (let k = -d; k <= d; k += 2) {
      const vk = max + k;
      let x: number;
      
      if (k === -d || (k !== d && v[vk - 1] < v[vk + 1])) {
        x = v[vk + 1];
      } else {
        x = v[vk - 1] + 1;
      }
      
      let y = x - k;
      
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      
      v[vk] = x;
      
      if (x >= n && y >= m) {
        return backtrack(trace, a, b, d, max);
      }
    }
  }
  
  return [];
}

function backtrack(
  trace: number[][],
  a: string[],
  b: string[],
  d: number,
  max: number
): Array<{ op: 'equal' | 'delete' | 'insert'; value: string }> {
  const result: Array<{ op: 'equal' | 'delete' | 'insert'; value: string }> = [];
  let x = a.length;
  let y = b.length;
  
  for (let currentD = d; currentD > 0; currentD--) {
    const v = trace[currentD];
    const k = x - y;
    const vk = max + k;
    
    let prevK: number;
    if (k === -currentD || (k !== currentD && v[vk - 1] < v[vk + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    
    const prevX = v[max + prevK];
    const prevY = prevX - prevK;
    
    while (x > prevX && y > prevY) {
      x--;
      y--;
      result.unshift({ op: 'equal', value: a[x] });
    }
    
    if (currentD > 0) {
      if (x === prevX) {
        y--;
        result.unshift({ op: 'insert', value: b[y] });
      } else {
        x--;
        result.unshift({ op: 'delete', value: a[x] });
      }
    }
  }
  
  return result;
}

export const diffLines = (text1: string, text2: string): DiffLine[] => {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  
  const rawDiff = myersDiff(lines1, lines2);
  
  const result: DiffLine[] = [];
  
  for (const item of rawDiff) {
    if (item.op === 'equal') {
      result.push({ value: item.value });
    } else if (item.op === 'delete') {
      result.push({ value: item.value, removed: true });
    } else {
      result.push({ value: item.value, added: true });
    }
  }
  
  return result;
};

export const diffLinesLCS = (text1: string, text2: string): DiffLine[] => {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  
  if (lines1.length > 1000 || lines2.length > 1000) {
    return diffLines(text1, text2);
  }
  
  const matrix: number[][] = [];

  for (let i = 0; i <= lines1.length; i++) {
    matrix[i] = new Array(lines2.length + 1).fill(0);
  }

  for (let i = 1; i <= lines1.length; i++) {
    for (let j = 1; j <= lines2.length; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = lines1.length;
  let j = lines2.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
      diff.unshift({ value: lines1[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      diff.unshift({ value: lines2[j - 1], added: true });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      diff.unshift({ value: lines1[i - 1], removed: true });
      i--;
    }
  }

  return diff;
};

export const processDiffWithContext = (diff: DiffLine[], contextLines = 3): ProcessedDiffBlock[] => {
  const blocks: ProcessedDiffBlock[] = [];
  let currentChunk: DiffLine[] = [];
  let unchangedCount = 0;

  for (let i = 0; i < diff.length; i++) {
    const line = diff[i];
    
    if (line.added || line.removed) {
      if (unchangedCount > contextLines * 2) {
        const preContext = currentChunk.slice(0, currentChunk.length - unchangedCount + contextLines);
        const collapsedLines = currentChunk.slice(currentChunk.length - unchangedCount + contextLines, currentChunk.length - contextLines);
        const postContext = currentChunk.slice(currentChunk.length - contextLines);

        if (preContext.length) blocks.push({ type: 'diff', lines: preContext });
        if (collapsedLines.length) blocks.push({ type: 'collapsed', lines: collapsedLines });
        
        currentChunk = [...postContext, line]; 
      } else {
        currentChunk.push(line);
      }
      unchangedCount = 0;
    } else {
      currentChunk.push(line);
      unchangedCount++;
    }
  }

  if (unchangedCount > contextLines * 2 && blocks.length > 0) {
    const preContext = currentChunk.slice(0, contextLines);
    const collapsedLines = currentChunk.slice(contextLines);
    
    if (preContext.length) blocks.push({ type: 'diff', lines: preContext });
    if (collapsedLines.length) blocks.push({ type: 'collapsed', lines: collapsedLines });
  } else {
    blocks.push({ type: 'diff', lines: currentChunk });
  }

  return blocks;
};

export function getDiffStats(diff: DiffLine[]): { added: number; removed: number; unchanged: number } {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  
  for (const line of diff) {
    if (line.added) added++;
    else if (line.removed) removed++;
    else unchanged++;
  }
  
  return { added, removed, unchanged };
}


export interface DiffLine {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/**
 * 计算两个文本之间的行级差异 (基于 LCS 算法的简化实现)
 */
export const diffLines = (text1: string, text2: string): DiffLine[] => {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const matrix: number[][] = [];

  // 初始化矩阵
  for (let i = 0; i <= lines1.length; i++) {
    matrix[i] = new Array(lines2.length + 1).fill(0);
  }

  // 填充矩阵
  for (let i = 1; i <= lines1.length; i++) {
    for (let j = 1; j <= lines2.length; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  // 回溯生成 Diff
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

export interface ProcessedDiffBlock {
  type: 'diff' | 'collapsed';
  lines: DiffLine[];
}

/**
 * 处理 Diff 结果，将过长的未修改代码折叠
 * @param diff 原始 Diff 数组
 * @param contextLines 保留上下文行数 (默认 3 行)
 */
export const processDiffWithContext = (diff: DiffLine[], contextLines = 3): ProcessedDiffBlock[] => {
  const blocks: ProcessedDiffBlock[] = [];
  let currentChunk: DiffLine[] = [];
  let unchangedCount = 0;

  for (let i = 0; i < diff.length; i++) {
    const line = diff[i];
    
    if (line.added || line.removed) {
      // 遇到变更，检查之前的未变更行是否需要折叠
      if (unchangedCount > contextLines * 2) {
        // 如果未变更行太多，进行折叠
        
        // 1. 这一块之前的 context
        const preContext = currentChunk.slice(0, currentChunk.length - unchangedCount + contextLines);
        // 2. 中间要被折叠的部分
        const collapsedLines = currentChunk.slice(currentChunk.length - unchangedCount + contextLines, currentChunk.length - contextLines);
        // 3. 紧接在变更之前的 context
        const postContext = currentChunk.slice(currentChunk.length - contextLines);

        if (preContext.length) blocks.push({ type: 'diff', lines: preContext });
        if (collapsedLines.length) blocks.push({ type: 'collapsed', lines: collapsedLines });
        
        // postContext 是新块的开始
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

  // 处理剩余部分
  if (unchangedCount > contextLines * 2 && blocks.length > 0) {
    // 结尾如果太长也折叠 (保留开头的 context)
    const preContext = currentChunk.slice(0, contextLines);
    const collapsedLines = currentChunk.slice(contextLines);
    
    if (preContext.length) blocks.push({ type: 'diff', lines: preContext });
    if (collapsedLines.length) blocks.push({ type: 'collapsed', lines: collapsedLines });
  } else {
    blocks.push({ type: 'diff', lines: currentChunk });
  }

  return blocks;
};

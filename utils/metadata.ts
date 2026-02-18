import { ScriptMetadata } from '../types';
import { escapeHtml } from './helpers';

const META_BLOCK_REGEX = /\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/;

export const parseScriptMetadata = (code: string): ScriptMetadata => {
  const metadata: ScriptMetadata = {
    name: '无标题脚本',
    match: [],
    exclude: []
  };

  const match = code.match(META_BLOCK_REGEX);
  if (!match) {
    return metadata;
  }

  const content = match[1];
  const lines = content.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('// @')) return;

    const parts = trimmed.substring(4).split(/\s+/);
    const key = parts[0];
    const value = parts.slice(1).join(' ');

    switch (key) {
      case 'name':
        metadata.name = escapeHtml(value) || '无标题脚本';
        break;
      case 'namespace':
        metadata.namespace = value;
        break;
      case 'version':
        metadata.version = escapeHtml(value);
        break;
      case 'description':
        metadata.description = escapeHtml(value);
        break;
      case 'author':
        metadata.author = value;
        break;
      case 'match':
        if (value) metadata.match.push(value);
        break;
      case 'exclude':
        if (value) metadata.exclude.push(value);
        break;
      case 'run-at':
        metadata.runAt = value;
        break;
    }
  });

  return metadata;
};

export const hasValidMetadata = (code: string): boolean => {
  return META_BLOCK_REGEX.test(code);
};

export const extractScriptName = (code: string): string => {
  const metadata = parseScriptMetadata(code);
  return metadata.name || '无标题脚本';
};

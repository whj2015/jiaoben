import { ScriptMetadata } from '../types';

export const parseMetadata = (code: string): ScriptMetadata => {
  const metadata: ScriptMetadata = {
    name: 'New Script',
    match: [],
    exclude: [],
    include: [],
    grant: [],
    require: [],
    resource: [],
    runAt: 'document-idle',
    connect: []
  };

  const metaBlockRegex = /\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/;
  const match = code.match(metaBlockRegex);

  if (match) {
    const content = match[1];
    const lines = content.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('// @')) return;

      // Extract key and value: // @key value...
      const matches = trimmed.match(/^\/\/ @(\w+)\s+(.*)$/);
      if (!matches) return;

      const key = matches[1];
      const value = matches[2].trim();

      switch (key) {
        case 'name': metadata.name = value; break;
        case 'namespace': metadata.namespace = value; break;
        case 'version': metadata.version = value; break;
        case 'description': metadata.description = value; break;
        case 'author': metadata.author = value; break;
        case 'match': metadata.match.push(value); break;
        case 'exclude': metadata.exclude.push(value); break;
        case 'include': metadata.include.push(value); break;
        case 'grant': metadata.grant.push(value); break;
        case 'require': metadata.require.push(value); break;
        case 'connect': metadata.connect.push(value); break;
        case 'run-at': 
          if (['document-start', 'document-end', 'document-idle', 'context-menu'].includes(value)) {
            metadata.runAt = value as any;
          }
          break;
        case 'noframes': metadata.noframes = true; break;
        case 'icon': metadata.icon = value; break;
        case 'resource': {
          const resParts = value.split(/\s+/);
          if (resParts.length >= 2) {
            metadata.resource.push({ name: resParts[0], url: resParts.slice(1).join(' ') });
          }
          break;
        }
      }
    });
  }

  // Fallback defaults
  if (metadata.match.length === 0 && metadata.include.length === 0) {
    metadata.match.push('*://*/*');
  }

  return metadata;
};

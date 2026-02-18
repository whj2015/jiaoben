export interface ScriptPermission {
  type: 'network' | 'storage' | 'dom' | 'cookies' | 'unsafe' | 'notification';
  level: 'safe' | 'warning' | 'danger';
  description: string;
}

const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/gi, type: 'unsafe' as const, description: '使用 eval() 动态执行代码' },
  { pattern: /Function\s*\(/gi, type: 'unsafe' as const, description: '使用 Function 构造函数动态执行代码' },
  { pattern: /document\.cookie/gi, type: 'cookies' as const, description: '访问或修改 Cookie' },
  { pattern: /localStorage|sessionStorage/gi, type: 'storage' as const, description: '访问本地存储' },
  { pattern: /XMLHttpRequest|fetch\s*\(/gi, type: 'network' as const, description: '发起网络请求' },
  { pattern: /GM_xmlhttpRequest/gi, type: 'network' as const, description: '使用 GM_xmlhttpRequest 发起跨域请求' },
  { pattern: /document\.write/gi, type: 'dom' as const, description: '使用 document.write 修改页面' },
  { pattern: /innerHTML\s*=/gi, type: 'dom' as const, description: '使用 innerHTML 可能导致 XSS' },
  { pattern: /outerHTML\s*=/gi, type: 'dom' as const, description: '使用 outerHTML 可能导致 XSS' },
  { pattern: /Notification/gi, type: 'notification' as const, description: '请求通知权限' },
  { pattern: /navigator\.geolocation/gi, type: 'unsafe' as const, description: '访问地理位置' },
  { pattern: /navigator\.camera|navigator\.mediaDevices/gi, type: 'unsafe' as const, description: '访问摄像头/麦克风' },
  { pattern: /WebSocket/gi, type: 'network' as const, description: '建立 WebSocket 连接' },
  { pattern: /window\.open/gi, type: 'dom' as const, description: '打开新窗口' },
  { pattern: /atob\s*\(|btoa\s*\(/gi, type: 'safe' as const, description: '使用 Base64 编解码' },
];

export function analyzeScriptPermissions(code: string): ScriptPermission[] {
  const permissions: ScriptPermission[] = [];
  const foundPatterns = new Set<string>();

  for (const { pattern, type, description } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      const key = `${type}-${description}`;
      if (!foundPatterns.has(key)) {
        foundPatterns.add(key);
        let level: ScriptPermission['level'] = 'safe';
        
        if (type === 'unsafe' || description.includes('eval') || description.includes('XSS')) {
          level = 'danger';
        } else if (type === 'network' || type === 'cookies' || description.includes('innerHTML')) {
          level = 'warning';
        }
        
        permissions.push({ type, level, description });
      }
    }
  }

  return permissions;
}

export function getSecurityWarning(permissions: ScriptPermission[]): string | null {
  const dangerPerms = permissions.filter(p => p.level === 'danger');
  const warningPerms = permissions.filter(p => p.level === 'warning');

  if (dangerPerms.length > 0) {
    return `此脚本包含潜在危险操作：${dangerPerms.map(p => p.description).join('、')}。请确保脚本来源可信。`;
  }

  if (warningPerms.length > 0) {
    return `此脚本需要以下权限：${warningPerms.map(p => p.description).join('、')}`;
  }

  return null;
}

export function extractExternalDomains(code: string): string[] {
  const domains: Set<string> = new Set();
  
  const urlPattern = /https?:\/\/([a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi;
  let match;
  while ((match = urlPattern.exec(code)) !== null) {
    domains.add(match[1]);
  }

  return Array.from(domains);
}

export function generateSecurityReport(code: string): {
  permissions: ScriptPermission[];
  warning: string | null;
  externalDomains: string[];
  riskLevel: 'low' | 'medium' | 'high';
} {
  const permissions = analyzeScriptPermissions(code);
  const warning = getSecurityWarning(permissions);
  const externalDomains = extractExternalDomains(code);

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (permissions.some(p => p.level === 'danger')) {
    riskLevel = 'high';
  } else if (permissions.some(p => p.level === 'warning')) {
    riskLevel = 'medium';
  }

  return {
    permissions,
    warning,
    externalDomains,
    riskLevel
  };
}

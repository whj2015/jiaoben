export interface ScriptLog {
  id: string;
  scriptId: string;
  scriptName: string;
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  url?: string;
}

const LOG_STORAGE_KEY = 'script_logs';
const MAX_LOGS_PER_SCRIPT = 100;
const MAX_TOTAL_LOGS = 1000;

export function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getScriptLogs(scriptId?: string): Promise<ScriptLog[]> {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    if (!stored) return [];
    
    const logs: ScriptLog[] = JSON.parse(stored);
    if (scriptId) {
      return logs.filter(log => log.scriptId === scriptId);
    }
    return logs;
  } catch {
    return [];
  }
}

export async function addScriptLog(log: Omit<ScriptLog, 'id'>): Promise<void> {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    let logs: ScriptLog[] = stored ? JSON.parse(stored) : [];
    
    const newLog: ScriptLog = {
      ...log,
      id: generateLogId()
    };
    
    logs.unshift(newLog);
    
    if (logs.length > MAX_TOTAL_LOGS) {
      const scriptLogs = new Map<string, ScriptLog[]>();
      for (const l of logs) {
        if (!scriptLogs.has(l.scriptId)) {
          scriptLogs.set(l.scriptId, []);
        }
        const scriptLogList = scriptLogs.get(l.scriptId)!;
        if (scriptLogList.length < MAX_LOGS_PER_SCRIPT) {
          scriptLogList.push(l);
        }
      }
      
      logs = [];
      for (const scriptLogList of scriptLogs.values()) {
        logs.push(...scriptLogList);
      }
      logs.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('[ScriptLogService] Failed to add log:', error);
  }
}

export async function clearScriptLogs(scriptId?: string): Promise<void> {
  try {
    if (scriptId) {
      const stored = localStorage.getItem(LOG_STORAGE_KEY);
      if (!stored) return;
      
      const logs: ScriptLog[] = JSON.parse(stored);
      const filtered = logs.filter(log => log.scriptId !== scriptId);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(filtered));
    } else {
      localStorage.removeItem(LOG_STORAGE_KEY);
    }
  } catch (error) {
    console.error('[ScriptLogService] Failed to clear logs:', error);
  }
}

export function formatLogMessage(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }).join(' ');
}

export const LOG_LEVEL_COLORS = {
  log: 'text-slate-600',
  info: 'text-blue-600',
  warn: 'text-amber-600',
  error: 'text-red-600'
};

export const LOG_LEVEL_BG_COLORS = {
  log: 'bg-slate-50',
  info: 'bg-blue-50',
  warn: 'bg-amber-50',
  error: 'bg-red-50'
};

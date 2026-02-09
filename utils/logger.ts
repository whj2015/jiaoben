/**
 * 日志系统模块
 * 提供分级日志功能，支持开发/生产环境切换
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  data?: unknown;
}

class Logger {
  private level: LogLevel;
  private context: string;
  private logs: LogEntry[] = [];
  private maxLogs: number = 100;

  constructor(context: string, level: LogLevel = this.getDefaultLevel()) {
    this.context = context;
    this.level = level;
  }

  private getDefaultLevel(): LogLevel {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return LogLevel.DEBUG;
    }
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      return LogLevel.DEBUG;
    }
    return LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${levelName}] [${this.context}] ${message}${dataStr}`;
  }

  private addLog(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: this.context,
      data
    };
    
    this.logs.push(entry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage(LogLevel.DEBUG, message, data);
      console.debug(formatted);
      this.addLog(LogLevel.DEBUG, message, data);
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(LogLevel.INFO, message, data);
      console.info(formatted);
      this.addLog(LogLevel.INFO, message, data);
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage(LogLevel.WARN, message, data);
      console.warn(formatted);
      this.addLog(LogLevel.WARN, message, data);
    }
  }

  error(message: string, error?: Error | unknown, data?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formatted = this.formatMessage(LogLevel.ERROR, message, data);
      console.error(formatted, error);
      this.addLog(LogLevel.ERROR, message, data);
    }
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level >= level);
    }
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

const loggers: Map<string, Logger> = new Map();

export function getLogger(context: string): Logger {
  if (!loggers.has(context)) {
    loggers.set(context, new Logger(context));
  }
  return loggers.get(context)!;
}

export function setGlobalLogLevel(level: LogLevel): void {
  loggers.forEach(logger => logger.setLevel(level));
}

export function getAllLogs(): LogEntry[] {
  const allLogs: LogEntry[] = [];
  loggers.forEach(logger => {
    allLogs.push(...logger.getLogs());
  });
  return allLogs.sort((a, b) => a.timestamp - b.timestamp);
}

export function clearAllLogs(): void {
  loggers.forEach(logger => logger.clearLogs());
}

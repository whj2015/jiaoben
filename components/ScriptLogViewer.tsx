import React, { useState, useEffect, useCallback } from 'react';
import { ScriptLog, getScriptLogs, clearScriptLogs, LOG_LEVEL_COLORS, LOG_LEVEL_BG_COLORS } from '../services/scriptLogService';
import { X, Trash2, AlertCircle, Info, AlertTriangle, Terminal, Clock } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { formatTimestamp } from '../utils/helpers';
import { useToast } from './Toast';

interface ScriptLogViewerProps {
  scriptId?: string;
  scriptName?: string;
  onClose: () => void;
}

const LogLevelIcon: React.FC<{ level: ScriptLog['level'] }> = ({ level }) => {
  switch (level) {
    case 'error':
      return <AlertCircle size={14} className="text-red-500" />;
    case 'warn':
      return <AlertTriangle size={14} className="text-amber-500" />;
    case 'info':
      return <Info size={14} className="text-blue-500" />;
    default:
      return <Terminal size={14} className="text-slate-400" />;
  }
};

const ScriptLogViewer: React.FC<ScriptLogViewerProps> = ({ scriptId, scriptName, onClose }) => {
  const [logs, setLogs] = useState<ScriptLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ScriptLog['level'] | 'all'>('all');
  const { t } = useTranslation();
  const { showConfirm, showToast } = useToast();

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getScriptLogs(scriptId);
      setLogs(data);
    } catch (error) {
      console.error('[ScriptLogViewer] Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  }, [scriptId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClearLogs = useCallback(() => {
    showConfirm(t('confirmClearLogs') || '确定清空所有日志？', async () => {
      await clearScriptLogs(scriptId);
      setLogs([]);
      showToast(t('logsCleared') || '日志已清空', 'success');
    });
  }, [scriptId, showConfirm, showToast, t]);

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              {scriptName ? `${t('scriptLogs') || '脚本日志'} - ${scriptName}` : t('allLogs') || '全部日志'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
            >
              <option value="all">{t('allLevels') || '全部级别'}</option>
              <option value="error">{t('error') || '错误'}</option>
              <option value="warn">{t('warning') || '警告'}</option>
              <option value="info">{t('info') || '信息'}</option>
              <option value="log">{t('log') || '日志'}</option>
            </select>
            <button
              onClick={handleClearLogs}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title={t('clearLogs') || '清空日志'}
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              {t('loading') || '加载中...'}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <Terminal size={32} className="opacity-50 mb-2" />
              <p className="text-sm">{t('noLogs') || '暂无日志记录'}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map(log => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs font-mono ${LOG_LEVEL_BG_COLORS[log.level]}`}
                >
                  <LogLevelIcon level={log.level} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${LOG_LEVEL_COLORS[log.level]}`}>
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        {formatTimestamp(log.timestamp)}
                      </span>
                      {!scriptId && (
                        <span className="text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                          {log.scriptName}
                        </span>
                      )}
                    </div>
                    <pre className={`whitespace-pre-wrap break-all ${LOG_LEVEL_COLORS[log.level]}`}>
                      {log.message}
                    </pre>
                    {log.url && (
                      <div className="text-slate-400 text-[10px] mt-1 truncate" title={log.url}>
                        {log.url}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-400">
          {t('totalLogs') || '共'} {filteredLogs.length} {t('entries') || '条'}日志
        </div>
      </div>
    </div>
  );
};

export default ScriptLogViewer;

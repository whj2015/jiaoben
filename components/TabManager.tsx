import React, { useEffect, useState, useCallback } from 'react';
import { TabInfo } from '../types';
import { getTabs, activateTab, closeTab } from '../services/extensionService';
import { X, Globe } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { escapeHtml } from '../utils/helpers';

const TabManager: React.FC = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const fetchTabs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tabList = await getTabs();
      setTabs(tabList);
    } catch (err) {
      console.error('[TabManager] Failed to fetch tabs:', err);
      setError(t('importError') + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTabs();
  }, [fetchTabs]);

  const handleClose = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      closeTab(id);
      setTabs(prev => prev.filter(tab => tab.id !== id));
    } catch (err) {
      console.error('[TabManager] Failed to close tab:', err);
      setError(t('importError') + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [t]);

  const handleActivate = useCallback((id: number) => {
    try {
      activateTab(id);
    } catch (err) {
      console.error('[TabManager] Failed to activate tab:', err);
      setError(t('importError') + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [t]);

  if (loading) {
    return <div className="p-8 text-center text-gray-400">{t('loading')}</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <div className="p-3 border-b border-gray-200 bg-white flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-700">{t('openTabs')} ({tabs.length})</h2>
        <button 
          onClick={fetchTabs} 
          className="text-xs text-blue-600 hover:underline"
          aria-label={t('refresh')}
        >
          {t('refresh')}
        </button>
      </div>
      
      {error && (
        <div className="mx-3 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800 font-bold"
          >
            ×
          </button>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tabs.map(tab => (
          <div 
            key={tab.id}
            onClick={() => handleActivate(tab.id)}
            className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
              tab.active 
                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' 
                : 'bg-white border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
              {tab.favIconUrl ? (
                <img 
                  src={tab.favIconUrl} 
                  alt="" 
                  className="w-5 h-5"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <Globe size={16} className={`text-gray-400 ${tab.favIconUrl ? 'hidden' : ''}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 
                className="text-sm font-medium text-gray-800 truncate"
                title={escapeHtml(tab.title)}
              >
                {escapeHtml(tab.title)}
              </h3>
              <p 
                className="text-xs text-gray-500 truncate"
                title={escapeHtml(tab.url)}
              >
                {escapeHtml(tab.url)}
              </p>
            </div>

            <button
              onClick={(e) => handleClose(e, tab.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
              title={t('closeTab')}
              aria-label={t('closeTab')}
            >
              <X size={16} />
            </button>
          </div>
        ))}
        
        {tabs.length === 0 && (
            <div className="text-center py-10 text-gray-400">
                {t('noActiveTabs')}
            </div>
        )}
      </div>
    </div>
  );
};

export default TabManager;

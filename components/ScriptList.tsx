import React, { useEffect, useState, useRef, useCallback } from 'react';
import { UserScript } from '../types';
import { getScripts, toggleScript, deleteScript, importScripts, exportBackup } from '../services/scriptService';
import { ToggleLeft, ToggleRight, Edit, Trash2, Box, Upload, Download, Search, Cloud } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { escapeHtml } from '../utils/helpers';
import { useToast } from './Toast';
import { isGitHubAuthenticated } from '../services/githubAuth';
import { checkScriptExistsInRepo, deleteScriptFromRepo } from '../services/githubRepo';

interface ScriptListProps {
  onEdit: (script: UserScript) => void;
}

interface ScriptWithCloudStatus extends UserScript {
  isCloudScript?: boolean;
}

const ScriptList: React.FC<ScriptListProps> = ({ onEdit }) => {
  const [scripts, setScripts] = useState<ScriptWithCloudStatus[]>([]);
  const [filteredScripts, setFilteredScripts] = useState<ScriptWithCloudStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGitHubAuthed, setIsGitHubAuthed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const { showToast, showConfirmWithOption } = useToast();

  const loadScripts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getScripts();
      
      const authed = await isGitHubAuthenticated();
      setIsGitHubAuthed(authed);
      
      if (authed && data.length > 0) {
        const scriptsWithStatus = await Promise.all(
          data.map(async (script) => {
            try {
              const result = await checkScriptExistsInRepo(script.name);
              return { ...script, isCloudScript: result.exists };
            } catch {
              return { ...script, isCloudScript: false };
            }
          })
        );
        setScripts(scriptsWithStatus);
        setFilteredScripts(scriptsWithStatus);
      } else {
        setScripts(data);
        setFilteredScripts(data);
      }
    } catch (err) {
      console.error('[ScriptList] Failed to load scripts:', err);
      setError(t('importError') + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredScripts(scripts);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredScripts(scripts.filter(script => 
        script.name.toLowerCase().includes(query) ||
        script.description?.toLowerCase().includes(query) ||
        script.match.some(m => m.toLowerCase().includes(query))
      ));
    }
  }, [scripts, searchQuery]);

  const handleToggle = useCallback(async (id: string, current: boolean) => {
    try {
      await toggleScript(id, !current);
      await loadScripts();
    } catch (err) {
      console.error('[ScriptList] Failed to toggle script:', err);
      showToast(t('importError') + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  }, [loadScripts, t, showToast]);

  const handleDelete = useCallback(async (e: React.MouseEvent, script: ScriptWithCloudStatus) => {
    e.stopPropagation();
    
    if (script.isCloudScript && isGitHubAuthed) {
      showConfirmWithOption(
        t('confirmDelete'),
        t('deleteFromCloud'),
        async (deleteFromCloud: boolean) => {
          try {
            await deleteScript(script.id);
            
            if (deleteFromCloud) {
              const result = await deleteScriptFromRepo(script.name);
              if (!result.success) {
                console.warn('[ScriptList] Failed to delete from cloud:', result.error);
              }
            }
            
            await loadScripts();
            showToast(t('delete') + ' ' + t('saved').toLowerCase(), 'success');
          } catch (err) {
            console.error('[ScriptList] Failed to delete script:', err);
            showToast(t('importError') + (err instanceof Error ? err.message : 'Unknown error'), 'error');
          }
        }
      );
    } else {
      showConfirmWithOption(
        t('confirmDelete'),
        '',
        async () => {
          try {
            await deleteScript(script.id);
            await loadScripts();
            showToast(t('delete') + ' ' + t('saved').toLowerCase(), 'success');
          } catch (err) {
            console.error('[ScriptList] Failed to delete script:', err);
            showToast(t('importError') + (err instanceof Error ? err.message : 'Unknown error'), 'error');
          }
        }
      );
    }
  }, [loadScripts, t, showToast, showConfirmWithOption, isGitHubAuthed]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      try {
        const count = await importScripts(file);
        showToast(t('importSuccess', { count: count.toString() }), 'success');
        await loadScripts();
      } catch (err) {
        console.error('[ScriptList] Import failed:', err);
        showToast(t('importError') + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      }
    }
  }, [loadScripts, t, showToast]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const count = await importScripts(e.target.files[0]);
        showToast(t('importSuccess', { count: count.toString() }), 'success');
        await loadScripts();
      } catch (err) {
        console.error('[ScriptList] Import failed:', err);
        showToast(t('importError') + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      }
    }
  }, [loadScripts, t, showToast]);

  if (loading) return <div className="p-10 text-center text-slate-400 text-sm">{t('loading')}</div>;

  return (
    <div 
      className={`flex flex-col h-full bg-slate-50 transition-colors ${isDragging ? 'bg-indigo-50/50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="px-4 py-3 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('installedScripts')}</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title={t('import')}
            >
              <Upload size={16} />
              <input ref={fileInputRef} type="file" accept=".js,.json" className="hidden" onChange={handleFileSelect} />
            </button>
            <button 
              onClick={() => exportBackup()}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title={t('exportBackup')}
            >
              <Download size={16} />
            </button>
          </div>
        </div>
        
        {scripts.length > 0 && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder') || '搜索脚本...'}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all bg-slate-50"
            />
          </div>
        )}
      </div>
      
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800 font-bold"
          >
            ×
          </button>
        </div>
      )}
      
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-500/10 backdrop-blur-sm border-2 border-dashed border-indigo-500 m-4 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-white p-4 rounded-xl shadow-xl flex flex-col items-center text-indigo-600 animate-in fade-in">
            <Upload size={32} className="mb-2" />
            <span className="font-bold text-sm">{t('import')}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredScripts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-10">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Box size={32} className="opacity-50" />
            </div>
            {searchQuery ? (
              <>
                <p className="font-medium text-sm text-slate-600">{t('noSearchResults') || '未找到匹配的脚本'}</p>
                <p className="text-xs mt-1 text-slate-400">{t('tryDifferentSearch') || '尝试其他搜索词'}</p>
              </>
            ) : (
              <>
                <p className="font-medium text-sm text-slate-600">{t('noScripts')}</p>
                <p className="text-xs mt-1 text-slate-400">{t('dragDropTip')}</p>
              </>
            )}
          </div>
        ) : (
          filteredScripts.map(script => (
            <div key={script.id} className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100 transition-all duration-200">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 
                      className="text-sm font-bold text-slate-800 truncate" 
                      title={escapeHtml(script.name)}
                      dangerouslySetInnerHTML={{ __html: escapeHtml(script.name) }}
                    />
                    <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono">v{escapeHtml(script.version)}</span>
                    {script.isCloudScript && (
                      <span className="flex items-center gap-0.5 text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded" title={t('cloudScript')}>
                        <Cloud size={10} />
                        <span>{t('cloud')}</span>
                      </span>
                    )}
                  </div>
                  <p 
                    className="text-xs text-slate-500 truncate"
                    dangerouslySetInnerHTML={{ __html: escapeHtml(script.description || t('noDescription')) }}
                  />
                </div>
                <button 
                  onClick={() => handleToggle(script.id, script.enabled)}
                  className={`flex-shrink-0 transition-colors ${script.enabled ? 'text-green-500 hover:text-green-600' : 'text-slate-300 hover:text-slate-400'}`}
                  aria-label={script.enabled ? 'Disable script' : 'Enable script'}
                >
                  {script.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                <div className="flex gap-1.5">
                   {script.match.slice(0, 2).map((m, i) => (
                     <span key={i} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100 max-w-[100px] truncate" title={escapeHtml(m)}>
                       {escapeHtml(m)}
                     </span>
                   ))}
                   {script.match.length > 2 && <span className="text-[10px] text-slate-400 px-1 py-1">+{script.match.length - 2}</span>}
                </div>
                
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onEdit(script)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    aria-label={t('edit')}
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(e, script)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    aria-label={t('delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ScriptList;

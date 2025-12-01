import React, { useEffect, useState, useRef } from 'react';
import { UserScript } from '../types';
import { getScripts, toggleScript, deleteScript, importScripts, exportBackup } from '../services/scriptService';
import { ToggleLeft, ToggleRight, Edit, Trash2, Box, Upload, Download, FileJson } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface ScriptListProps {
  onEdit: (script: UserScript) => void;
}

const ScriptList: React.FC<ScriptListProps> = ({ onEdit }) => {
  const [scripts, setScripts] = useState<UserScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const loadScripts = async () => {
    setLoading(true);
    const data = await getScripts();
    setScripts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const handleToggle = async (id: string, current: boolean) => {
    await toggleScript(id, !current);
    loadScripts();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(t('confirmDelete'))) {
      await deleteScript(id);
      loadScripts();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      try {
        const count = await importScripts(file);
        alert(t('importSuccess', { count: count.toString() }));
        loadScripts();
      } catch (err) {
        alert(t('importError') + err);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const count = await importScripts(e.target.files[0]);
        alert(t('importSuccess', { count: count.toString() }));
        loadScripts();
      } catch (err) {
        alert(t('importError') + err);
      }
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-400 text-sm">{t('loading')}</div>;

  return (
    <div 
      className={`flex flex-col h-full bg-slate-50 transition-colors ${isDragging ? 'bg-indigo-50/50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Toolbar */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
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
      
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-500/10 backdrop-blur-sm border-2 border-dashed border-indigo-500 m-4 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-white p-4 rounded-xl shadow-xl flex flex-col items-center text-indigo-600 animate-in fade-in">
            <Upload size={32} className="mb-2" />
            <span className="font-bold text-sm">{t('import')}</span>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {scripts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-10">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Box size={32} className="opacity-50" />
            </div>
            <p className="font-medium text-sm text-slate-600">{t('noScripts')}</p>
            <p className="text-xs mt-1 text-slate-400">{t('dragDropTip')}</p>
          </div>
        ) : (
          scripts.map(script => (
            <div key={script.id} className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100 transition-all duration-200">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-800 truncate" title={script.name}>{script.name}</h3>
                    <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono">v{script.version}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{script.description || t('noDescription')}</p>
                </div>
                <button 
                  onClick={() => handleToggle(script.id, script.enabled)}
                  className={`flex-shrink-0 transition-colors ${script.enabled ? 'text-green-500 hover:text-green-600' : 'text-slate-300 hover:text-slate-400'}`}
                >
                  {script.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                <div className="flex gap-1.5">
                   {script.match.slice(0, 2).map((m, i) => (
                     <span key={i} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100 max-w-[100px] truncate">
                       {m}
                     </span>
                   ))}
                   {script.match.length > 2 && <span className="text-[10px] text-slate-400 px-1 py-1">+{script.match.length - 2}</span>}
                </div>
                
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onEdit(script)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(e, script.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
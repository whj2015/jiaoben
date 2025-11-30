import React, { useEffect, useState } from 'react';
import { UserScript } from '../types';
import { getScripts, toggleScript, deleteScript } from '../services/scriptService';
import { ToggleLeft, ToggleRight, Edit, Trash2, Play } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface ScriptListProps {
  onEdit: (script: UserScript) => void;
}

const ScriptList: React.FC<ScriptListProps> = ({ onEdit }) => {
  const [scripts, setScripts] = useState<UserScript[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-3 border-b border-gray-200 bg-white flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-700">{t('installedScripts')} ({scripts.length})</h2>
        <button onClick={loadScripts} className="text-xs text-purple-600 hover:underline">{t('refresh')}</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {scripts.length === 0 ? (
          <div className="text-center py-10 text-gray-400 flex flex-col items-center">
            <Play size={48} className="mb-2 opacity-20" />
            <p>{t('noScripts')}</p>
            <p className="text-xs mt-1">{t('createOne')}</p>
          </div>
        ) : (
          scripts.map(script => (
            <div key={script.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{script.name}</h3>
                  <p className="text-xs text-gray-500">v{script.version}</p>
                </div>
                <button 
                  onClick={() => handleToggle(script.id, script.enabled)}
                  className={`text-2xl transition-colors ${script.enabled ? 'text-green-500' : 'text-gray-300'}`}
                >
                  {script.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </div>
              
              <div className="text-xs text-gray-500 mb-3 truncate">
                 {script.description || 'No description'}
              </div>

              <div className="flex gap-2">
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] truncate max-w-[150px]">
                  {t('matches')}: {script.match[0] || '*'} {script.match.length > 1 ? `+${script.match.length - 1}` : ''}
                </span>
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-50">
                <button 
                  onClick={() => onEdit(script)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                >
                  <Edit size={12} /> {t('edit')}
                </button>
                <button 
                  onClick={(e) => handleDelete(e, script.id)}
                  className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                >
                  <Trash2 size={12} /> {t('delete')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ScriptList;
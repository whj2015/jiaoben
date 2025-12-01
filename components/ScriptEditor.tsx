import React, { useState, useEffect } from 'react';
import { UserScript, ScriptVersion } from '../types';
import { DEFAULT_SCRIPT_TEMPLATE, saveScript, createScriptFromCode, deleteScriptVersion, exportScriptFile } from '../services/scriptService';
import { generateScriptWithAI } from '../services/geminiService';
import { getActiveTabInfo } from '../services/extensionService';
import { Save, Sparkles, AlertCircle, ArrowLeft, RefreshCw, Link2, History, RotateCcw, X, Clock, Split, Trash2, Download } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { diffLines, processDiffWithContext } from '../utils/simpleDiff';

interface ScriptEditorProps {
  initialScript?: UserScript | null;
  onSave: () => void;
  onCancel: () => void;
}

const formatTime = (ts: number) => {
  if (!ts) return "--/--";
  return new Date(ts).toLocaleString(undefined, {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const HistoryDiffModal: React.FC<{
  version: ScriptVersion;
  currentCode: string;
  onRestore: () => void;
  onClose: () => void;
}> = ({ version, currentCode, onRestore, onClose }) => {
  const { t } = useTranslation();
  const [onlyChanges, setOnlyChanges] = useState(false);

  const diffData = React.useMemo(() => {
    const rawDiff = diffLines(version.code, currentCode);
    return onlyChanges ? processDiffWithContext(rawDiff) : [{ type: 'diff', lines: rawDiff } as const];
  }, [version.code, currentCode, onlyChanges]);

  let oldLineNum = 1;
  let newLineNum = 1;

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <X size={20} />
          </button>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{t('compareChanges')}</h3>
            <p className="text-xs text-slate-500 font-mono">v{version.version} • {formatTime(version.timestamp)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
             <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
             {t('onlyChanges')}
           </label>
           <button onClick={onRestore} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm shadow-indigo-200">
             {t('restoreThis')}
           </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-white font-mono text-[11px] leading-5">
        {diffData.map((block, bIdx) => {
          if (block.type === 'collapsed') {
            const lineCount = block.lines.length;
            oldLineNum += lineCount; newLineNum += lineCount;
            return (
              <div key={bIdx} onClick={() => setOnlyChanges(false)} className="bg-slate-50 py-2 text-slate-400 text-center cursor-pointer hover:bg-slate-100 border-y border-slate-100 select-none">
                {t('linesHidden', {count: String(lineCount)})}
              </div>
            );
          }
          return block.lines.map((line, lIdx) => {
             const isAdded = line.added;
             const isRemoved = line.removed;
             const currentOld = isAdded ? null : oldLineNum++;
             const currentNew = isRemoved ? null : newLineNum++;
             return (
               <div key={`${bIdx}-${lIdx}`} className={`flex ${isAdded ? 'bg-green-50/50' : isRemoved ? 'bg-red-50/50' : ''}`}>
                 <div className="w-12 flex-shrink-0 flex text-slate-300 select-none bg-slate-50 border-r border-slate-100 text-right pr-2 gap-2">
                   <span className="w-5">{isAdded ? '' : currentOld}</span>
                 </div>
                 <div className="flex-1 px-3 break-all relative">
                   {isAdded && <span className="absolute left-1 text-green-500">+</span>}
                   {isRemoved && <span className="absolute left-1 text-red-500">-</span>}
                   <span className={isAdded ? 'text-green-800' : isRemoved ? 'text-red-800 line-through decoration-red-300' : 'text-slate-600'}>{line.value || ' '}</span>
                 </div>
               </div>
             );
          });
        })}
      </div>
    </div>
  );
};

const ScriptEditor: React.FC<ScriptEditorProps> = ({ initialScript, onSave, onCancel }) => {
  const [code, setCode] = useState(DEFAULT_SCRIPT_TEMPLATE);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Add saving state
  const [error, setError] = useState<string | null>(null);
  const [contextUrl, setContextUrl] = useState<string>('');
  
  const [showHistory, setShowHistory] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ScriptVersion | null>(null);
  const [historyUpdateTrigger, setHistoryUpdateTrigger] = useState(0);
  
  const { t } = useTranslation();

  useEffect(() => {
    if (initialScript) setCode(initialScript.code);
    getActiveTabInfo().then(tab => { if (tab?.url) setContextUrl(tab.url); });
  }, [initialScript]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const script = createScriptFromCode(code, initialScript?.id);
      // Preserve history and storage
      if (initialScript) {
        script.history = initialScript.history;
        script.storage = initialScript.storage;
      }
      
      // Async save (might fetch dependencies)
      await saveScript(script);
      onSave();
    } catch (e: any) { 
      setError(t('failedToSave') + ': ' + e.message); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = () => {
    if (viewingVersion && confirm(t('restoreConfirm'))) {
      setCode(viewingVersion.code);
      setViewingVersion(null);
      setShowHistory(false);
    }
  };

  const handleDeleteVersion = async (e: React.MouseEvent, timestamp: number) => {
    e.stopPropagation();
    if (!initialScript) return;
    if (confirm(t('confirmDeleteVersion'))) {
      await deleteScriptVersion(initialScript.id, timestamp);
      initialScript.history = initialScript.history?.filter(h => h.timestamp !== timestamp);
      setHistoryUpdateTrigger(prev => prev + 1);
    }
  };

  const handleAIGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    let newCode = "";
    const isUpdateMode = code.trim() !== DEFAULT_SCRIPT_TEMPLATE.trim() && code.trim().length > 0;

    try {
      await generateScriptWithAI(prompt, (chunk) => {
        newCode += chunk;
        if (newCode.length > 20) setCode(newCode);
      }, isUpdateMode ? code : undefined, contextUrl);
      if (newCode) setCode(newCode);
    } catch (err: any) {
      setError(err.message === 'MISSING_API_KEY' ? t('apiKeyMissing') : t('aiError'));
    } finally {
      setIsGenerating(false);
    }
  };

  const contextDomain = contextUrl ? new URL(contextUrl).hostname : t('globalContext');

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {viewingVersion && <HistoryDiffModal version={viewingVersion} currentCode={code} onRestore={handleRestore} onClose={() => setViewingVersion(null)} />}

      {/* Toolbar */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-slate-100 bg-white z-10">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800">{initialScript ? t('editorEdit') : t('editorNew')}</span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1"><Link2 size={10} /> {contextDomain}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {initialScript && (
             <>
               <button onClick={() => exportScriptFile(initialScript)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title={t('exportScript')}>
                 <Download size={18} />
               </button>
               <button onClick={() => setShowHistory(!showHistory)} className={`p-1.5 rounded transition-colors ${showHistory ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`} title={t('history')}>
                 <History size={18} />
               </button>
             </>
          )}
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className={`bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all flex items-center gap-1.5 ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} 
            {t('save')}
          </button>
        </div>
      </div>

      {/* Editor & AI Container */}
      <div className="flex-1 relative flex flex-col">
        <textarea
          className="flex-1 w-full p-4 font-mono text-xs leading-5 resize-none outline-none text-slate-700 bg-white"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
        />
        
        {/* Floating AI Bar */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-white/90 backdrop-blur-md p-2 rounded-xl border border-indigo-100 shadow-lg shadow-slate-200/50 flex flex-col gap-2">
            <div className="flex gap-2">
               <input 
                  type="text" 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  placeholder={code.length > 100 ? t('promptUpdatePlaceholder') : t('promptPlaceholder')}
                  disabled={isGenerating}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
               />
               <button 
                 onClick={handleAIGenerate} 
                 disabled={isGenerating || !prompt} 
                 className={`px-3 rounded-lg text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 ${isGenerating ? 'bg-slate-300 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200'}`}
               >
                 {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Sparkles size={14} />}
               </button>
            </div>
            {error && <div className="text-[10px] text-red-500 px-1 flex items-center gap-1"><AlertCircle size={10} /> {error}</div>}
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="absolute top-0 right-0 bottom-0 w-64 bg-white border-l border-slate-200 shadow-2xl z-20 animate-in slide-in-from-right duration-200 flex flex-col">
           <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <h3 className="font-bold text-xs text-slate-700 flex items-center gap-1.5"><Clock size={14} className="text-indigo-500" /> {t('history')}</h3>
             <button onClick={() => setShowHistory(false)}><X size={16} className="text-slate-400 hover:text-slate-600" /></button>
           </div>
           <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {!initialScript?.history?.length ? (
                <div className="text-center py-10 text-slate-300 text-xs">{t('noHistory')}</div>
              ) : (
                initialScript.history.map((ver, idx) => (
                  <div key={idx} onClick={() => setViewingVersion(ver)} className="group p-3 rounded-lg border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all relative">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-slate-600">{formatTime(ver.timestamp)}</span>
                      <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500 group-hover:bg-white">v{ver.version}</span>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-[10px] text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Split size={12} /> {t('compareChanges')}</span>
                      <button onClick={(e) => handleDeleteVersion(e, ver.timestamp)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default ScriptEditor;

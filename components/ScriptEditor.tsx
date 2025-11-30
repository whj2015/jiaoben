import React, { useState, useEffect } from 'react';
import { UserScript, ScriptVersion } from '../types';
import { DEFAULT_SCRIPT_TEMPLATE, saveScript, createScriptFromCode, clearScriptHistory } from '../services/scriptService';
import { generateScriptWithAI } from '../services/geminiService';
import { getActiveTabInfo } from '../services/extensionService';
import { Save, Sparkles, AlertCircle, ArrowLeft, RefreshCw, Link2, History, RotateCcw, X, Clock, Split, ChevronRight, Trash2 } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { diffLines, processDiffWithContext } from '../utils/simpleDiff';

interface ScriptEditorProps {
  initialScript?: UserScript | null;
  onSave: () => void;
  onCancel: () => void;
}

// Helper to format timestamp
const formatTime = (ts: number) => {
  if (!ts) return "Unknown Date";
  return new Date(ts).toLocaleString(undefined, {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

// --- Modal Component for Diff View ---
const HistoryDiffModal: React.FC<{
  version: ScriptVersion;
  currentCode: string;
  onRestore: () => void;
  onClose: () => void;
}> = ({ version, currentCode, onRestore, onClose }) => {
  const { t } = useTranslation();
  const [onlyChanges, setOnlyChanges] = useState(false);

  // Memoize diff calculation
  const diffData = React.useMemo(() => {
    const rawDiff = diffLines(version.code, currentCode);
    if (onlyChanges) {
      return processDiffWithContext(rawDiff);
    }
    return [{ type: 'diff', lines: rawDiff } as const];
  }, [version.code, currentCode, onlyChanges]);

  let oldLineNum = 1;
  let newLineNum = 1;

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
          <div>
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <Split size={16} className="text-purple-600" />
              {t('compareChanges')}
            </h3>
            <p className="text-xs text-gray-500">
               {t('version')}: v{version.version} ({formatTime(version.timestamp)})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
             <input 
               type="checkbox" 
               checked={onlyChanges} 
               onChange={(e) => setOnlyChanges(e.target.checked)}
               className="rounded text-purple-600 focus:ring-purple-500" 
             />
             {t('onlyChanges')}
           </label>
           <div className="h-4 w-px bg-gray-300 mx-1"></div>
           <button 
             onClick={onRestore}
             className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 hover:bg-blue-700 shadow-sm"
           >
             <RotateCcw size={14} /> {t('restoreThis')}
           </button>
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto bg-white font-mono text-xs">
        {diffData.map((block, bIdx) => {
          if (block.type === 'collapsed') {
            // Update line numbers for hidden lines
            const lineCount = block.lines.length;
            oldLineNum += lineCount;
            newLineNum += lineCount;
            
            return (
              <div 
                key={bIdx} 
                onClick={() => setOnlyChanges(false)}
                className="bg-gray-100 py-2 px-4 text-gray-500 text-center cursor-pointer hover:bg-gray-200 select-none border-y border-gray-200"
              >
                {t('linesHidden').replace('{{count}}', String(lineCount))} — {t('showAll')}
              </div>
            );
          }

          return block.lines.map((line, lIdx) => {
             const isAdded = line.added;
             const isRemoved = line.removed;
             const currentOld = isAdded ? null : oldLineNum++;
             const currentNew = isRemoved ? null : newLineNum++;

             return (
               <div 
                 key={`${bIdx}-${lIdx}`} 
                 className={`flex ${isAdded ? 'bg-green-50' : isRemoved ? 'bg-red-50' : ''} hover:bg-gray-50`}
               >
                 {/* Line Numbers */}
                 <div className="w-16 flex-shrink-0 flex text-gray-400 select-none bg-gray-50 border-r border-gray-200 text-[10px] leading-5">
                   <div className="w-8 text-right pr-1">{isAdded ? '' : currentOld}</div>
                   <div className="w-8 text-right pr-1">{isRemoved ? '' : currentNew}</div>
                 </div>
                 
                 {/* Code Content */}
                 <div className="flex-1 px-2 leading-5 whitespace-pre-wrap break-all relative">
                   {isAdded && <span className="absolute left-0 text-green-600 font-bold">+</span>}
                   {isRemoved && <span className="absolute left-0 text-red-600 font-bold">-</span>}
                   <span className={`pl-3 block ${isAdded ? 'text-green-900' : isRemoved ? 'text-red-900 line-through opacity-70' : 'text-gray-800'}`}>
                     {line.value || ' '}
                   </span>
                 </div>
               </div>
             );
          });
        })}
      </div>
    </div>
  );
};

// --- Main Editor Component ---
const ScriptEditor: React.FC<ScriptEditorProps> = ({ initialScript, onSave, onCancel }) => {
  const [code, setCode] = useState(DEFAULT_SCRIPT_TEMPLATE);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextUrl, setContextUrl] = useState<string>('');
  
  // UI States
  const [showHistory, setShowHistory] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ScriptVersion | null>(null);
  
  const { t } = useTranslation();

  useEffect(() => {
    if (initialScript) {
      setCode(initialScript.code);
    }
  }, [initialScript]);

  useEffect(() => {
    getActiveTabInfo().then(tab => {
      if (tab && tab.url) {
        setContextUrl(tab.url);
      }
    });
  }, []);

  const handleSave = async () => {
    try {
      const script = createScriptFromCode(code, initialScript?.id);
      if (initialScript && initialScript.history) {
        script.history = initialScript.history;
      }
      await saveScript(script);
      onSave();
    } catch (e) {
      setError(t('failedToSave'));
    }
  };

  const handleRestore = () => {
    if (viewingVersion && confirm(t('restoreConfirm'))) {
      setCode(viewingVersion.code);
      setViewingVersion(null);
      setShowHistory(false);
    }
  };

  const handleClearHistory = async () => {
    if (!initialScript) return;
    if (confirm(t('confirmClearHistory'))) {
       await clearScriptHistory(initialScript.id);
       // Reset local history to update UI immediately
       initialScript.history = []; 
       setShowHistory(false);
       alert(t('historyCleared'));
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
        if (newCode.length > 20) {
             setCode(newCode);
        }
      }, isUpdateMode ? code : undefined, contextUrl);
      
      if (newCode) setCode(newCode);
    } catch (err: any) {
      if (err.message === 'MISSING_API_KEY') {
        setError(t('apiKeyMissing'));
      } else {
        setError(t('aiError'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const hasExistingCode = code.trim() !== DEFAULT_SCRIPT_TEMPLATE.trim() && code.trim().length > 0;
  const contextDomain = contextUrl ? new URL(contextUrl).hostname : '';

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* Diff Modal Overlay */}
      {viewingVersion && (
        <HistoryDiffModal 
          version={viewingVersion}
          currentCode={code}
          onRestore={handleRestore}
          onClose={() => setViewingVersion(null)}
        />
      )}

      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-800">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-sm font-semibold">{initialScript ? t('editorEdit') : t('editorNew')}</h2>
        </div>
        
        <div className="flex items-center gap-2">
           {initialScript && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-1.5 rounded transition-colors flex items-center gap-1 text-xs font-medium ${
                showHistory ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
              }`}
              title={t('viewHistory')}
            >
              <History size={16} /> {showHistory ? t('close') : t('history')}
            </button>
           )}
          <button 
            onClick={handleSave}
            className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 hover:bg-purple-700"
          >
            <Save size={14} /> {t('save')}
          </button>
        </div>
      </div>

      {/* AI Assistant Bar */}
      <div className="p-3 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center gap-1.5 mb-2 text-xs text-purple-700 bg-purple-100/50 p-1.5 rounded">
           <Link2 size={12} />
           <span className="font-semibold">{t('context')}:</span>
           <span className="truncate flex-1" title={contextUrl || t('globalContext')}>
             {contextDomain ? contextDomain : t('globalContext')}
           </span>
        </div>

        <div className="flex gap-2">
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={hasExistingCode ? t('promptUpdatePlaceholder') : t('promptPlaceholder')}
            className="flex-1 text-xs p-2 rounded border border-purple-200 focus:border-purple-500 outline-none"
            disabled={isGenerating}
          />
          <button 
            onClick={handleAIGenerate}
            disabled={isGenerating || !prompt}
            className={`px-3 py-1 rounded text-xs font-bold text-white flex items-center gap-1 transition-all min-w-[100px] justify-center ${
              isGenerating ? 'bg-gray-400' : 'bg-purple-500 hover:bg-purple-600'
            }`}
          >
            {isGenerating ? (
              t('thinking')
            ) : hasExistingCode ? (
              <><RefreshCw size={14} /> {t('refine')}</>
            ) : (
              <><Sparkles size={14} /> {t('autoCode')}</>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </div>
        )}
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 relative flex">
        <textarea
          className="flex-1 h-full p-4 font-mono text-xs leading-5 resize-none outline-none text-gray-800 bg-white"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
        />

        {/* History Sidebar */}
        {showHistory && (
          <div className="w-64 border-l border-gray-200 bg-white shadow-xl flex flex-col z-20 absolute right-0 top-0 bottom-0 animate-in slide-in-from-right duration-200">
             <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
               <h3 className="font-semibold text-xs text-gray-700 flex items-center gap-1">
                 <Clock size={14} /> {t('history')}
               </h3>
               <div className="flex items-center gap-1">
                 {initialScript?.history && initialScript.history.length > 0 && (
                   <button 
                     onClick={handleClearHistory}
                     className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                     title={t('clearHistory')}
                   >
                     <Trash2 size={14} />
                   </button>
                 )}
                 <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-700 p-1">
                   <X size={16} />
                 </button>
               </div>
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {!initialScript?.history || initialScript.history.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    {t('noHistory')}
                  </div>
                ) : (
                  initialScript.history.map((ver, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setViewingVersion(ver)}
                      className="p-3 rounded-lg border border-gray-100 cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all group relative"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-gray-700">
                           {formatTime(ver.timestamp)}
                        </span>
                        <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                          v{ver.version || '?'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 group-hover:text-purple-600">
                         <Split size={12} /> {t('compareChanges')}
                         <ChevronRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScriptEditor;
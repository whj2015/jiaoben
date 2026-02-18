import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserScript, ScriptVersion } from '../types';
import { DEFAULT_SCRIPT_TEMPLATE, saveScript, createScriptFromCode, deleteScriptVersion, exportScriptFile } from '../services/scriptService';
import { startAIGeneration, getAIGenerationStatus, completeAIGeneration, cancelAIGeneration } from '../services/backgroundAI';
import { getActiveTabInfo } from '../services/extensionService';
import { Save, Sparkles, AlertCircle, ArrowLeft, Link2, History, X, Clock, Split, Trash2, Download, Check, Shield, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { diffLines, processDiffWithContext } from '../utils/simpleDiff';
import { escapeHtml, formatTimestamp } from '../utils/helpers';
import { useAIGeneration } from '../App';
import { useToast } from './Toast';
import { generateSecurityReport } from '../utils/scriptSecurity';

const MAX_SCRIPT_SIZE = 1024 * 1024;
const MAX_PROMPT_LENGTH = 5000;
const SAVE_STATUS_TIMEOUT = 2000;
const MIN_CODE_LENGTH_FOR_UPDATE = 20;

interface ScriptEditorProps {
  initialScript?: UserScript | null;
  onSave: () => void;
  onCancel: () => void;
}

const HistoryDiffModal: React.FC<{
  version: ScriptVersion;
  currentCode: string;
  onRestore: () => void;
  onClose: () => void;
}> = ({ version, currentCode, onRestore, onClose }) => {
  const { t } = useTranslation();
  const [onlyChanges, setOnlyChanges] = useState(false);

  const diffData = useMemo(() => {
    const rawDiff = diffLines(version.code, currentCode);
    return onlyChanges ? processDiffWithContext(rawDiff) : [{ type: 'diff', lines: rawDiff } as const];
  }, [version.code, currentCode, onlyChanges]);

  const renderDiffLines = useMemo(() => {
    let oldLineNum = 1;
    let newLineNum = 1;

    return diffData.map((block, bIdx) => {
      if (block.type === 'collapsed') {
        const lineCount = block.lines.length;
        oldLineNum += lineCount;
        newLineNum += lineCount;
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
         return (
           <div key={`${bIdx}-${lIdx}`} className={`flex ${isAdded ? 'bg-green-50/50' : isRemoved ? 'bg-red-50/50' : ''}`}>
             <div className="w-12 flex-shrink-0 flex text-slate-300 select-none bg-slate-50 border-r border-slate-100 text-right pr-2 gap-2">
               <span className="w-5">{isAdded ? '' : currentOld}</span>
             </div>
             <div className="flex-1 px-3 break-all relative">
               {isAdded && <span className="absolute left-1 text-green-500">+</span>}
               {isRemoved && <span className="absolute left-1 text-red-500">-</span>}
               <span className={isAdded ? 'text-green-800' : isRemoved ? 'text-red-800 line-through decoration-red-300' : 'text-slate-600'} dangerouslySetInnerHTML={{ __html: escapeHtml(line.value || ' ') }} />
             </div>
           </div>
         );
      });
    });
  }, [diffData, t]);

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <X size={20} />
          </button>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{t('compareChanges')}</h3>
            <p className="text-xs text-slate-500 font-mono">v{escapeHtml(version.version)} • {formatTimestamp(version.timestamp)}</p>
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
        {renderDiffLines}
      </div>
    </div>
  );
};

const ScriptEditor: React.FC<ScriptEditorProps> = ({ initialScript, onSave, onCancel }) => {
  const [code, setCode] = useState(DEFAULT_SCRIPT_TEMPLATE);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextUrl, setContextUrl] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [localScriptId, setLocalScriptId] = useState<string | undefined>(initialScript?.id);
  const [scriptName, setScriptName] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ScriptVersion | null>(null);
  const [securityReport, setSecurityReport] = useState<ReturnType<typeof generateSecurityReport> | null>(null);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);
  
  const { t } = useTranslation();
  const { setStatus } = useAIGeneration();
  const { showConfirm, showToast } = useToast();

  const performInternalSave = useCallback(async (codeToSave: string) => {
    try {
      const script = createScriptFromCode(codeToSave, localScriptId);
      
      if (!localScriptId) {
        setLocalScriptId(script.id);
      }

      setScriptName(script.name);

      if (initialScript?.history && initialScript.id === script.id) {
        script.history = initialScript.history;
      }

      await saveScript(script);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), SAVE_STATUS_TIMEOUT);
      return true;
    } catch (e) {
      setError(t('failedToSave'));
      return false;
    }
  }, [localScriptId, initialScript, t]);

  const handleAIGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    setError(null);
    const isUpdateMode = (code.trim() !== DEFAULT_SCRIPT_TEMPLATE.trim() && code.trim().length > 0) || !!localScriptId;
    const currentScriptName = scriptName || (isUpdateMode ? t('editorEdit') : t('editorNew'));

    setStatus({
      isGenerating: true,
      scriptId: localScriptId || null,
      scriptName: currentScriptName,
      progress: t('aiGenerating') || 'AI 正在生成...'
    });

    try {
      await startAIGeneration(
        prompt,
        localScriptId || null,
        currentScriptName,
        isUpdateMode ? code : undefined,
        contextUrl
      );

      const pollInterval = setInterval(async () => {
        try {
          const status = await getAIGenerationStatus();
          
          if (status.generatedCode && status.generatedCode.length > MIN_CODE_LENGTH_FOR_UPDATE) {
            setCode(status.generatedCode);
          }
          
          setStatus(prev => ({
            ...prev,
            progress: status.progress || (t('aiGenerating') || 'AI 正在生成...')
          }));

          if (!status.isGenerating) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            
            if (status.error) {
              setError(status.error === 'MISSING_API_KEY' ? t('apiKeyMissing') : status.error);
              setStatus({
                isGenerating: false,
                scriptId: null,
                scriptName: '',
                progress: ''
              });
            } else if (status.generatedCode) {
              const savedScript = createScriptFromCode(status.generatedCode, localScriptId);
              setStatus(prev => ({
                ...prev,
                scriptName: savedScript.name,
                progress: t('saving') || '正在保存...'
              }));
              await performInternalSave(status.generatedCode);
              await completeAIGeneration();
              setStatus({
                isGenerating: false,
                scriptId: null,
                scriptName: '',
                progress: ''
              });
            }
          }
        } catch (pollError) {
          console.error('[ScriptEditor] Poll error:', pollError);
        }
      }, 500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage === 'MISSING_API_KEY' ? t('apiKeyMissing') : t('aiError'));
      setIsGenerating(false);
      setStatus({
        isGenerating: false,
        scriptId: null,
        scriptName: '',
        progress: ''
      });
    }
  }, [prompt, code, localScriptId, contextUrl, performInternalSave, t, isGenerating, scriptName, setStatus]);

  useEffect(() => {
    if (initialScript) {
      setCode(initialScript.code);
      setLocalScriptId(initialScript.id);
      setScriptName(initialScript.name);
    }
    getActiveTabInfo().then(tab => { if (tab?.url) setContextUrl(tab.url); });
  }, [initialScript]);

  const handleManualSave = useCallback(async () => {
    const report = generateSecurityReport(code);
    setSecurityReport(report);

    if (report.riskLevel === 'high' && !localScriptId) {
      showConfirm(
        `${t('securityWarning')}：${report.warning || t('securityDangerousScript')}`,
        async () => {
          const success = await performInternalSave(code);
          if (success) {
            showToast(t('saved'), 'success');
            onSave();
          }
        },
        () => {
          showToast(t('saveCancelled'), 'info');
        }
      );
    } else {
      const success = await performInternalSave(code);
      if (success) {
        onSave();
      }
    }
  }, [code, performInternalSave, onSave, localScriptId, showConfirm, showToast, t]);

  const handleRestore = useCallback(() => {
    if (viewingVersion) {
      showConfirm(t('restoreConfirm'), () => {
        setCode(viewingVersion.code);
        setViewingVersion(null);
        setShowHistory(false);
      });
    }
  }, [viewingVersion, t, showConfirm]);

  const handleDeleteVersion = useCallback(async (e: React.MouseEvent, timestamp: number) => {
    e.stopPropagation();
    if (!initialScript) return;
    showConfirm(t('confirmDeleteVersion'), async () => {
      try {
        await deleteScriptVersion(initialScript.id, timestamp);
        initialScript.history = initialScript.history?.filter(h => h.timestamp !== timestamp);
        initialScript.history = [...(initialScript.history || [])];
      } catch (err) {
        console.error('[ScriptEditor] Failed to delete version:', err);
        setError(t('failedToSave'));
      }
    });
  }, [initialScript, t, showConfirm]);

  const contextDomain = (() => {
    if (!contextUrl) return t('globalContext');
    try {
      return new URL(contextUrl).hostname;
    } catch {
      return t('globalContext');
    }
  })();

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {viewingVersion && <HistoryDiffModal version={viewingVersion} currentCode={code} onRestore={handleRestore} onClose={() => setViewingVersion(null)} />}

      <div className="px-4 py-3 flex justify-between items-center border-b border-slate-100 bg-white z-10">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800">{localScriptId ? t('editorEdit') : t('editorNew')}</span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1"><Link2 size={10} /> {escapeHtml(contextDomain)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <span className="text-[10px] font-bold text-green-600 flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
              <Check size={12} /> {t('saved')}
            </span>
          )}

          {(initialScript || localScriptId) && (
             <>
               <button onClick={() => {
                   const tempScript = createScriptFromCode(code, localScriptId);
                   exportScriptFile(tempScript);
               }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title={t('exportScript')}>
                 <Download size={18} />
               </button>
               <button onClick={() => setShowHistory(!showHistory)} className={`p-1.5 rounded transition-colors ${showHistory ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`} title={t('history')}>
                 <History size={18} />
               </button>
             </>
          )}
          <button onClick={handleManualSave} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all flex items-center gap-1.5">
            <Save size={14} /> {t('save')}
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col">
        <textarea
          className="flex-1 w-full p-4 font-mono text-xs leading-5 resize-none outline-none text-slate-700 bg-white"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          maxLength={MAX_SCRIPT_SIZE}
          aria-label="Script code editor"
        />
        
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-white/90 backdrop-blur-md p-2 rounded-xl border border-indigo-100 shadow-lg shadow-slate-200/50 flex flex-col gap-2">
            <div className="flex gap-2">
               <input 
                  type="text" 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAIGenerate();
                    }
                  }}
                  placeholder={code.length > 100 || localScriptId ? t('promptUpdatePlaceholder') : t('promptPlaceholder')}
                  disabled={isGenerating}
                  maxLength={MAX_PROMPT_LENGTH}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                  aria-label="AI prompt input"
               />
               <button 
                 onClick={handleAIGenerate} 
                 disabled={isGenerating || !prompt} 
                 className={`px-3 rounded-lg text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 ${isGenerating ? 'bg-slate-300 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200'}`}
                 aria-label="Generate with AI"
               >
                 {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Sparkles size={14} />}
               </button>
            </div>
            {error && (
              <div className="text-[10px] text-red-500 px-1 flex items-center gap-1">
                <AlertCircle size={10} /> {escapeHtml(error)}
                <button 
                  onClick={() => setError(null)}
                  className="ml-auto text-red-600 hover:text-red-800 font-bold"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
                      <span className="text-xs font-semibold text-slate-600">{formatTimestamp(ver.timestamp)}</span>
                      <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500 group-hover:bg-white">{escapeHtml('v' + ver.version)}</span>
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
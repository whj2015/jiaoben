import React, { useState, useEffect } from 'react';
import { UserScript, ScriptVersion } from '../types';
import { DEFAULT_SCRIPT_TEMPLATE, saveScript, createScriptFromCode } from '../services/scriptService';
import { generateScriptWithAI } from '../services/geminiService';
import { getActiveTabInfo } from '../services/extensionService';
import { Save, Sparkles, AlertCircle, ArrowLeft, RefreshCw, Link2, History, RotateCcw, X, Clock } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface ScriptEditorProps {
  initialScript?: UserScript | null;
  onSave: () => void;
  onCancel: () => void;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({ initialScript, onSave, onCancel }) => {
  const [code, setCode] = useState(DEFAULT_SCRIPT_TEMPLATE);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextUrl, setContextUrl] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (initialScript) {
      setCode(initialScript.code);
    }
  }, [initialScript]);

  // Fetch active tab info on mount to set context
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
      // 如果是编辑模式，确保将现有的历史记录传递进去，以便 saveScript 能正确追加
      if (initialScript && initialScript.history) {
        script.history = initialScript.history;
      }
      await saveScript(script);
      onSave();
    } catch (e) {
      setError(t('failedToSave'));
    }
  };

  const handleRestore = (version: ScriptVersion) => {
    if (confirm(t('restoreConfirm'))) {
      setCode(version.code);
      setShowHistory(false);
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

  // Extract domain for display
  const contextDomain = contextUrl ? new URL(contextUrl).hostname : '';

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
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
              onClick={() => setShowHistory(true)}
              className="text-gray-500 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors"
              title={t('viewHistory')}
            >
              <History size={18} />
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

      <div className="flex-1 relative">
        <textarea
          className="w-full h-full p-4 font-mono text-xs leading-5 resize-none outline-none text-gray-800 bg-white"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="absolute inset-0 bg-black/20 z-20 flex justify-end animate-in fade-in duration-200">
          <div className="w-64 bg-white h-full shadow-2xl flex flex-col border-l border-gray-200">
             <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
               <h3 className="font-semibold text-sm flex items-center gap-2">
                 <History size={16} /> {t('history')}
               </h3>
               <button onClick={() => setShowHistory(false)} className="text-gray-500 hover:text-gray-800">
                 <X size={18} />
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {!initialScript?.history || initialScript.history.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    {t('noHistory')}
                  </div>
                ) : (
                  initialScript.history.map((ver, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                          <Clock size={10} /> {formatTime(ver.timestamp)}
                        </span>
                        <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                          v{ver.version || '?'}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button 
                          onClick={() => handleRestore(ver)}
                          className="text-[10px] flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm"
                        >
                          <RotateCcw size={10} /> {t('restore')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptEditor;
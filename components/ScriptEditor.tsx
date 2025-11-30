import React, { useState, useEffect } from 'react';
import { UserScript } from '../types';
import { DEFAULT_SCRIPT_TEMPLATE, saveScript, createScriptFromCode } from '../services/scriptService';
import { generateScriptWithAI } from '../services/geminiService';
import { getActiveTabInfo } from '../services/extensionService';
import { Save, Sparkles, AlertCircle, ArrowLeft, RefreshCw, Link2 } from 'lucide-react';
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
      await saveScript(script);
      onSave();
    } catch (e) {
      setError(t('failedToSave'));
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

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-sm font-semibold">{initialScript ? t('editorEdit') : t('editorNew')}</h2>
        <button 
          onClick={handleSave}
          className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 hover:bg-purple-700"
        >
          <Save size={14} /> {t('save')}
        </button>
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
    </div>
  );
};

export default ScriptEditor;
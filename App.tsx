import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ScriptList from './components/ScriptList';
import ScriptEditor from './components/ScriptEditor';
import ErrorBoundary from './components/ErrorBoundary';
import { ViewState, UserScript, Language, AIProvider } from './types';
import { CheckCircle, Key, Eye, EyeOff, AlertTriangle, Globe, Bot, Database, Upload, Download } from 'lucide-react';
import { 
  getStoredApiKey, setStoredApiKey, 
  getStoredDeepSeekKey, setStoredDeepSeekKey,
  getStoredAIProvider, setStoredAIProvider,
  exportBackup, importScripts
} from './services/scriptService';
import { LanguageProvider, useTranslation } from './utils/i18n';

const SettingsView: React.FC = () => {
  const [googleKey, setGoogleKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [provider, setProvider] = useState<AIProvider>(AIProvider.GOOGLE);
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { t, language, setLanguage } = useTranslation();

  useEffect(() => {
    getStoredApiKey().then(setGoogleKey);
    getStoredDeepSeekKey().then(setDeepseekKey);
    getStoredAIProvider().then(setProvider);
  }, []);

  const handleSaveKeys = async () => {
    setSaveStatus('saving');
    await setStoredApiKey(googleKey.trim());
    await setStoredDeepSeekKey(deepseekKey.trim());
    await setStoredAIProvider(provider);
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      try {
        const count = await importScripts(e.target.files[0]);
        alert(t('importSuccess', { count: String(count) }));
      } catch(err) { alert(t('importError') + err); }
    }
  };

  return (
    <div className="p-4 space-y-4 pb-10">
      <h2 className="text-xl font-bold text-slate-800 mb-2">{t('settingsTitle')}</h2>
      
      {/* AI Config Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Bot size={18} className="text-indigo-600" />
          <h3 className="font-bold text-sm text-slate-700">{t('aiProvider')}</h3>
        </div>
        <div className="p-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-4">
            {[AIProvider.GOOGLE, AIProvider.DEEPSEEK].map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                  provider === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === AIProvider.GOOGLE ? 'Google Gemini' : 'DeepSeek'}
              </button>
            ))}
          </div>
          <div className="relative">
             <input
               type={showKey ? "text" : "password"}
               value={provider === AIProvider.GOOGLE ? googleKey : deepseekKey}
               onChange={(e) => provider === AIProvider.GOOGLE ? setGoogleKey(e.target.value) : setDeepseekKey(e.target.value)}
               placeholder={provider === AIProvider.GOOGLE ? t('apiKeyPlaceholder') : t('deepseekKeyPlaceholder')}
               className="w-full pl-3 pr-10 py-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
             />
             <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
               {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
             </button>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveKeys}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                saveStatus === 'saved' ? 'bg-green-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {saveStatus === 'saved' ? <CheckCircle size={14} /> : t('saveKey')}
            </button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Database size={18} className="text-teal-600" />
          <h3 className="font-bold text-sm text-slate-700">{t('dataManagement')}</h3>
        </div>
        <div className="p-4 flex gap-3">
          <button onClick={() => exportBackup()} className="flex-1 py-2.5 border border-slate-200 rounded-lg flex items-center justify-center gap-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
            <Download size={14} /> {t('exportBackup')}
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2.5 border border-slate-200 rounded-lg flex items-center justify-center gap-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
            <Upload size={14} /> {t('import')}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Globe size={18} className="text-blue-500" />
          <h3 className="font-bold text-sm text-slate-700">{t('language')}</h3>
        </div>
        <div className="p-4">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
          >
            <option value={Language.EN}>English</option>
            <option value={Language.ZH_CN}>简体中文</option>
            <option value={Language.JA}>日本語</option>
            <option value={Language.ES}>Español</option>
          </select>
        </div>
      </div>

      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex gap-2 items-start">
        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-700 leading-4">{t('devModeDesc')}</p>
      </div>
    </div>
  );
};

const MainApp: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.LIST);
  const [editingScript, setEditingScript] = useState<UserScript | null>(null);

  const handleEdit = (script: UserScript) => { setEditingScript(script); setView(ViewState.EDITOR); };
  const handleSetView = (newView: ViewState) => { if(newView === ViewState.EDITOR) setEditingScript(null); setView(newView); };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 text-slate-800">
      <Header currentView={view} setView={handleSetView} />
      <main className="flex-1 overflow-hidden relative">
        {view === ViewState.LIST && <ScriptList onEdit={handleEdit} />}
        {view === ViewState.EDITOR && <ScriptEditor initialScript={editingScript} onSave={() => setView(ViewState.LIST)} onCancel={() => setView(ViewState.LIST)} />}
        {view === ViewState.SETTINGS && <div className="h-full overflow-y-auto"><SettingsView /></div>}
      </main>
    </div>
  );
};

export default function App() { 
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <MainApp />
      </LanguageProvider>
    </ErrorBoundary>
  );
}
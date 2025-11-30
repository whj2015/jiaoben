import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ScriptList from './components/ScriptList';
import ScriptEditor from './components/ScriptEditor';
import { ViewState, UserScript, Language } from './types';
import { CheckCircle, Key, Eye, EyeOff, AlertTriangle, Globe } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey } from './services/scriptService';
import { LanguageProvider, useTranslation } from './utils/i18n';

const SettingsView: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const { t, language, setLanguage } = useTranslation();

  useEffect(() => {
    getStoredApiKey().then(key => {
      if (key) setApiKey(key);
    });
  }, []);

  const handleSaveKey = async () => {
    setSaveStatus('saving');
    await setStoredApiKey(apiKey.trim());
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">{t('settingsTitle')}</h2>
      
      {/* Language Selector */}
      <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-gray-700">
          <Globe size={18} className="text-blue-600" />
          <h3 className="text-sm font-semibold">{t('language')}</h3>
        </div>
        
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all bg-white"
        >
          <option value={Language.EN}>English</option>
          <option value={Language.ZH_CN}>简体中文</option>
          <option value={Language.JA}>日本語</option>
          <option value={Language.ES}>Español</option>
        </select>
      </div>

      <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-gray-700">
          <Key size={18} className="text-purple-600" />
          <h3 className="text-sm font-semibold">{t('apiKeyTitle')}</h3>
        </div>
        
        <p className="text-xs text-gray-500 mb-3">
          {t('apiKeyDesc')}
        </p>

        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('apiKeyPlaceholder')}
            className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500 outline-none transition-all"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSaveKey}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              saveStatus === 'saved'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            {saveStatus === 'saved' ? (
              <>
                <CheckCircle size={14} /> {t('saved')}
              </>
            ) : (
              t('saveKey')
            )}
          </button>
        </div>
      </div>

      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
        <div className="flex gap-2 items-start">
          <AlertTriangle size={16} className="text-yellow-600 mt-0.5 shrink-0" />
          <div className="text-xs text-yellow-700">
            <p className="font-semibold mb-1">{t('devModeTitle')}</p>
            <p>{t('devModeDesc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MainApp: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.LIST);
  const [editingScript, setEditingScript] = useState<UserScript | null>(null);

  const handleEdit = (script: UserScript) => {
    setEditingScript(script);
    setView(ViewState.EDITOR);
  };

  const handleCreateNew = () => {
    setEditingScript(null);
    setView(ViewState.EDITOR);
  };

  const handleSetView = (newView: ViewState) => {
    if (newView === ViewState.EDITOR) {
      setEditingScript(null);
    }
    setView(newView);
  };

  const renderContent = () => {
    switch (view) {
      case ViewState.LIST: 
        return <ScriptList onEdit={handleEdit} />;
      case ViewState.EDITOR: 
        return (
          <ScriptEditor 
            initialScript={editingScript} 
            onSave={() => setView(ViewState.LIST)}
            onCancel={() => setView(ViewState.LIST)}
          />
        );
      case ViewState.SETTINGS: 
        return <SettingsView />;
      default: 
        return <ScriptList onEdit={handleEdit} />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white font-sans text-gray-900">
      <Header currentView={view} setView={handleSetView} />
      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}
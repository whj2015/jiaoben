import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import Header from './components/Header';
import ScriptList from './components/ScriptList';
import ScriptEditor from './components/ScriptEditor';
import ErrorBoundary from './components/ErrorBoundary';
import GitHubSync from './components/GitHubSync';
import { ToastProvider, useToast } from './components/Toast';
import { 
  ViewState, UserScript, Language, AIProvider,
  GitHubUser, GitHubAuthState, SyncProgress, SyncResult
} from './types';
import { CheckCircle, Eye, EyeOff, AlertTriangle, Globe, Bot, Database, Upload, Download, Github, Cloud, Key, ExternalLink, Check, X, Loader2 } from 'lucide-react';
import { 
  getStoredApiKey, setStoredApiKey, 
  getStoredDeepSeekKey, setStoredDeepSeekKey,
  getStoredAIProvider, setStoredAIProvider,
  exportBackup, importScripts
} from './services/scriptService';
import { 
  getGitHubSession, logoutGitHub, getStoredToken, setStoredToken, 
  hasGitHubCredentials, loginWithToken
} from './services/githubAuth';
import { 
  checkRepoExists, createScriptRepo, getRepoContents, uploadAllScripts
} from './services/githubRepo';
import { LanguageProvider, useTranslation } from './utils/i18n';
import { getAIGenerationStatus } from './services/backgroundAI';

interface AIGenerationStatus {
  isGenerating: boolean;
  scriptId: string | null;
  scriptName: string;
  progress: string;
}

interface AIGenerationContextType {
  status: AIGenerationStatus;
  setStatus: (status: AIGenerationStatus | ((prev: AIGenerationStatus) => AIGenerationStatus)) => void;
  generatedCode: string;
  setGeneratedCode: (code: string) => void;
}

const AIGenerationContext = createContext<AIGenerationContextType | null>(null);

export const useAIGeneration = () => {
  const context = useContext(AIGenerationContext);
  if (!context) {
    throw new Error('useAIGeneration must be used within AIGenerationProvider');
  }
  return context;
};

const AIGenerationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AIGenerationStatus>({
    isGenerating: false,
    scriptId: null,
    scriptName: '',
    progress: ''
  });
  const [generatedCode, setGeneratedCode] = useState('');
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getAIGenerationStatus().then(bgStatus => {
      if (bgStatus.isGenerating || bgStatus.generatedCode) {
        setStatus({
          isGenerating: bgStatus.isGenerating,
          scriptId: bgStatus.scriptId,
          scriptName: bgStatus.scriptName,
          progress: bgStatus.progress
        });
        if (bgStatus.generatedCode) {
          setGeneratedCode(bgStatus.generatedCode);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (status.isGenerating && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const bgStatus = await getAIGenerationStatus();
          setStatus(prev => ({
            ...prev,
            isGenerating: bgStatus.isGenerating,
            progress: bgStatus.progress
          }));
          if (bgStatus.generatedCode) {
            setGeneratedCode(bgStatus.generatedCode);
          }
        } catch (e) {
          console.error('[AIGenerationProvider] Poll error:', e);
        }
      }, 1000);
    } else if (!status.isGenerating && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [status.isGenerating]);

  return (
    <AIGenerationContext.Provider value={{ status, setStatus, generatedCode, setGeneratedCode }}>
      {children}
    </AIGenerationContext.Provider>
  );
};

const AIGenerationIndicator: React.FC<{ onViewScript?: () => void }> = ({ onViewScript }) => {
  const { status } = useAIGeneration();
  const { t } = useTranslation();
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    if (status.isGenerating) {
      const interval = setInterval(() => {
        setProgressWidth(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 5;
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      setProgressWidth(0);
    }
  }, [status.isGenerating]);

  if (!status.isGenerating) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl shadow-lg overflow-hidden z-50 animate-in slide-in-from-bottom duration-300">
      <div 
        className="absolute inset-0 bg-indigo-500/30 transition-all duration-300"
        style={{ width: `${progressWidth}%` }}
      />
      <div className="relative p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium">{status.progress || t('aiGenerating') || 'AI 正在生成脚本...'}</p>
            <p className="text-xs text-indigo-200">{status.scriptName}</p>
          </div>
        </div>
        <button
          onClick={onViewScript}
          className="text-xs bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-1.5"
        >
          <Eye size={14} />
          {t('viewProgress') || '查看进度'}
        </button>
      </div>
    </div>
  );
};

interface SettingsViewProps {
  gitHubUser: GitHubUser | null;
  gitHubAuthState: GitHubAuthState;
  syncProgress: SyncProgress | null;
  syncResult: SyncResult | null;
  showSyncModal: boolean;
  onGitHubLoginSuccess: () => void;
  onGitHubLogout: () => void;
  onStartSync: () => void;
  onCloseSyncModal?: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  gitHubUser,
  gitHubAuthState,
  syncProgress,
  syncResult,
  showSyncModal,
  onGitHubLoginSuccess,
  onGitHubLogout,
  onStartSync
}) => {
  const [googleKey, setGoogleKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [provider, setProvider] = useState<AIProvider>(AIProvider.GOOGLE);
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [gitHubToken, setGitHubToken] = useState('');
  const [showGitHubToken, setShowGitHubToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { t, language, setLanguage } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    getStoredApiKey().then(setGoogleKey);
    getStoredDeepSeekKey().then(setDeepseekKey);
    getStoredAIProvider().then(setProvider);
    hasGitHubCredentials().then(setHasCredentials);
    getStoredToken().then(token => setGitHubToken(token));
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

  const handleGitHubLogin = async () => {
    if (!gitHubToken.trim()) {
      setLoginError(t('gitHubTokenEmpty'));
      return;
    }

    setIsValidating(true);
    setLoginError(null);

    try {
      await loginWithToken(gitHubToken.trim());
      setHasCredentials(true);
      onGitHubLoginSuccess();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : t('gitHubTokenInvalid'));
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      try {
        const count = await importScripts(e.target.files[0]);
        showToast(t('importSuccess', { count: String(count) }), 'success');
      } catch(err) { 
        showToast(t('importError') + err, 'error'); 
      }
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

      {/* GitHub Section */}
      {gitHubUser ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Cloud size={18} className="text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-700">{t('gitHubSync')}</h3>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img 
                    src={gitHubUser.avatar_url} 
                    alt={gitHubUser.login} 
                    className="w-10 h-10 rounded-full border-2 border-slate-200"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{gitHubUser.name || gitHubUser.login}</p>
                    <p className="text-xs text-slate-500">@{gitHubUser.login}</p>
                  </div>
                </div>
                <button
                  onClick={onGitHubLogout}
                  className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 hover:bg-red-50 rounded"
                >
                  {t('logout') || '登出'}
                </button>
              </div>
              
              {syncProgress && showSyncModal ? (
                <GitHubSync progress={syncProgress} result={syncResult || undefined} onRetry={onStartSync} />
              ) : (
                <button
                  onClick={onStartSync}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                >
                  <Cloud size={16} />
                  <span>{t('startSync') || '开始同步脚本'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Github size={18} className="text-slate-700" />
            <h3 className="font-bold text-sm text-slate-700">{t('gitHubSync')}</h3>
          </div>
          <div className="p-4">
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-start gap-2">
                <Key size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-blue-700 font-medium mb-1">{t('gitHubTokenRequired')}</p>
                  <p className="text-xs text-blue-600">
                    {t('gitHubTokenDesc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-500">Personal Access Token</label>
                  <a
                    href="https://github.com/settings/tokens/new?description=EdgeGenius%20%E8%84%9A%E6%9C%AC%E5%90%8C%E6%AD%A5&scopes=repo,user"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    创建 Token <ExternalLink size={10} />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showGitHubToken ? "text" : "password"}
                    value={gitHubToken}
                    onChange={(e) => setGitHubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 pr-10 py-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-mono"
                  />
                  <button 
                    onClick={() => setShowGitHubToken(!showGitHubToken)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showGitHubToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <X size={12} /> {loginError}
                </p>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Check size={12} className="text-green-500" />
                <span>需要勾选 repo 和 user 权限</span>
              </div>

              <button
                onClick={handleGitHubLogin}
                disabled={!gitHubToken.trim() || isValidating}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>验证中...</span>
                  </>
                ) : (
                  <>
                    <Github size={14} />
                    <span>连接 GitHub</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center">
                {t('gitHubConnectDesc')}
              </p>
            </div>
          </div>
        </div>
      )}

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
  const [gitHubUser, setGitHubUser] = useState<GitHubUser | null>(null);
  const [gitHubAuthState, setGitHubAuthState] = useState<GitHubAuthState>(GitHubAuthState.UNAUTHENTICATED);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  useEffect(() => {
    const checkGitHubSession = async () => {
      try {
        const session = await getGitHubSession();
        if (session && session.user) {
          setGitHubUser(session.user);
          setGitHubAuthState(GitHubAuthState.AUTHENTICATED);
        }
      } catch (error) {
        console.error('Failed to check GitHub session:', error);
      }
    };
    checkGitHubSession();
  }, []);

  const handleEdit = (script: UserScript) => { setEditingScript(script); setView(ViewState.EDITOR); };
  const handleSetView = (newView: ViewState) => { if(newView === ViewState.EDITOR) setEditingScript(null); setView(newView); };

  const handleGitHubLoginSuccess = useCallback(() => {
    const checkSession = async () => {
      try {
        const session = await getGitHubSession();
        if (session && session.user) {
          setGitHubUser(session.user);
          setGitHubAuthState(GitHubAuthState.AUTHENTICATED);
        }
      } catch (error) {
        console.error('Failed to get GitHub session after login:', error);
        setGitHubAuthState(GitHubAuthState.ERROR);
      }
    };
    checkSession();
  }, []);

  const handleGitHubLogout = useCallback(async () => {
    try {
      await logoutGitHub();
      setGitHubUser(null);
      setGitHubAuthState(GitHubAuthState.UNAUTHENTICATED);
      setSyncProgress(null);
      setSyncResult(null);
      setShowSyncModal(false);
    } catch (error) {
      console.error('Failed to logout from GitHub:', error);
    }
  }, []);

  const handleOpenGitHubSettings = useCallback(() => {
    setView(ViewState.SETTINGS);
  }, []);

  const startSync = useCallback(async () => {
    if (!gitHubUser) return;
    
    setShowSyncModal(true);
    setSyncProgress({ phase: 'checking', current: 0, total: 0, message: '正在检查仓库...' });
    setSyncResult(null);

    try {
      let repoCreated = false;
      let repo = await checkRepoExists();
      
      if (!repo) {
        setSyncProgress({ phase: 'checking', current: 0, total: 1, message: '正在创建仓库...' });
        repo = await createScriptRepo();
        repoCreated = true;
      }

      const contents = await getRepoContents('');
      const scriptFiles = Array.isArray(contents) ? contents.filter(c => c.type === 'file' && c.name.endsWith('.js')) : [];
      
      let imported = 0;
      let uploaded = 0;
      let skipped = 0;
      const errors: string[] = [];

      if (scriptFiles.length > 0) {
        setSyncProgress({ 
          phase: 'downloading', 
          current: 0, 
          total: scriptFiles.length, 
          message: '正在下载脚本...' 
        });

        for (let i = 0; i < scriptFiles.length; i++) {
          const file = scriptFiles[i];
          setSyncProgress(prev => prev ? { 
            ...prev, 
            current: i + 1, 
            currentFile: file.name 
          } : null);

          try {
            if (file.download_url) {
              const response = await fetch(file.download_url);
              if (response.ok) {
                const code = await response.text();
                const { importScriptToLocal } = await import('./services/scriptImport');
                await importScriptToLocal(code, file.name);
                imported++;
              } else {
                skipped++;
                errors.push(`${file.name}: 下载失败`);
              }
            }
          } catch (err) {
            skipped++;
            const errorMsg = err instanceof Error ? err.message : String(err);
            errors.push(`${file.name}: ${errorMsg}`);
          }
        }
      }

      setSyncProgress({ 
        phase: 'uploading', 
        current: 0, 
        total: 0, 
        message: '正在上传本地脚本...' 
      });

      const uploadResult = await uploadAllScripts();
      uploaded = uploadResult.uploaded;
      errors.push(...uploadResult.errors);

      setSyncProgress({ phase: 'completed', current: 1, total: 1 });
      setSyncResult({
        success: errors.length === 0,
        imported,
        uploaded,
        skipped,
        errors,
        repoCreated
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setSyncProgress({ phase: 'error', current: 0, total: 0, message: errorMsg });
      setSyncResult({
        success: false,
        imported: 0,
        uploaded: 0,
        skipped: 0,
        errors: [errorMsg],
        repoCreated: false
      });
    }
  }, [gitHubUser]);

  const closeSyncModal = useCallback(() => {
    setShowSyncModal(false);
  }, []);

  const handleViewGeneratingScript = useCallback(() => {
    setView(ViewState.EDITOR);
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 text-slate-800">
      <Header 
        currentView={view} 
        setView={handleSetView} 
        gitHubUser={gitHubUser}
        onGitHubLogout={handleGitHubLogout}
        onGitHubSettings={handleOpenGitHubSettings}
      />
      <main className="flex-1 overflow-hidden relative">
        {view === ViewState.LIST && <ScriptList onEdit={handleEdit} />}
        {view === ViewState.EDITOR && <ScriptEditor initialScript={editingScript} onSave={() => setView(ViewState.LIST)} onCancel={() => setView(ViewState.LIST)} />}
        {view === ViewState.SETTINGS && (
          <div className="h-full overflow-y-auto">
            <SettingsView 
              gitHubUser={gitHubUser}
              gitHubAuthState={gitHubAuthState}
              syncProgress={syncProgress}
              syncResult={syncResult}
              showSyncModal={showSyncModal}
              onGitHubLoginSuccess={handleGitHubLoginSuccess}
              onGitHubLogout={handleGitHubLogout}
              onStartSync={startSync}
              onCloseSyncModal={closeSyncModal}
            />
          </div>
        )}
      </main>
      <AIGenerationIndicator onViewScript={handleViewGeneratingScript} />
    </div>
  );
};

export default function App() { 
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ToastProvider>
          <AIGenerationProvider>
            <MainApp />
          </AIGenerationProvider>
        </ToastProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
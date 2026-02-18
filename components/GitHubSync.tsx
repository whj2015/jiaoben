import React from 'react';
import { SyncProgress, SyncResult } from '../types';
import { Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw, Github, Upload, Download, FileCode } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface GitHubSyncProps {
  progress: SyncProgress;
  result?: SyncResult;
  onRetry?: () => void;
}

const GitHubSync: React.FC<GitHubSyncProps> = ({ progress, result, onRetry }) => {
  const { t } = useTranslation();

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const renderCheckingState = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <div className="relative">
        <Github size={40} className="text-slate-300" />
        <Loader2 size={16} className="text-indigo-600 absolute -bottom-1 -right-1 animate-spin" />
      </div>
      <p className="text-sm text-slate-600 font-medium">{t('gitHubCheckingRepo')}</p>
      {progress.message && (
        <p className="text-xs text-slate-400">{progress.message}</p>
      )}
    </div>
  );

  const renderProgressState = () => {
    const isDownloading = progress.phase === 'downloading';
    const Icon = isDownloading ? Download : Upload;
    const label = isDownloading ? t('gitHubDownloading') : t('gitHubUploading');

    return (
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={18} className={isDownloading ? 'text-blue-500' : 'text-indigo-600'} />
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </div>
          <span className="text-sm font-bold text-indigo-600">{percentage}%</span>
        </div>

        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{progress.current} / {progress.total}</span>
          {progress.currentFile && (
            <div className="flex items-center gap-1.5 max-w-[200px]">
              <FileCode size={12} className="shrink-0" />
              <span className="truncate">{progress.currentFile}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCompletedState = () => {
    if (!result) return null;

    return (
      <div className="space-y-4 py-4">
        <div className="flex items-center gap-2">
          {result.success ? (
            <CheckCircle size={20} className="text-green-500" />
          ) : (
            <AlertCircle size={20} className="text-amber-500" />
          )}
          <span className="text-sm font-medium text-slate-700">
            {result.success ? t('gitHubSyncSuccess') : t('gitHubSyncSuccess') + ' (' + t('gitHubErrors') + ')'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
            <div className="text-lg font-bold text-green-600">{result.imported}</div>
            <div className="text-xs text-green-600">{t('gitHubImported')}</div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
            <div className="text-lg font-bold text-indigo-600">{result.uploaded}</div>
            <div className="text-xs text-indigo-600">{t('gitHubUploaded')}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
            <div className="text-lg font-bold text-slate-600">{result.skipped}</div>
            <div className="text-xs text-slate-500">{t('gitHubSkipped')}</div>
          </div>
        </div>

        {result.repoCreated && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 flex items-start gap-2">
            <Github size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">{t('gitHubRepoCreated')}</p>
          </div>
        )}

        {result.errors.length > 0 && (
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={14} className="text-red-500" />
              <span className="text-xs font-medium text-red-700">{t('gitHubErrors')} ({result.errors.length})</span>
            </div>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((error, index) => (
                <li key={index} className="text-xs text-red-600 pl-6 relative before:content-['•'] before:absolute before:left-4 before:text-red-400">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderErrorState = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
        <XCircle size={24} className="text-red-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700">{t('gitHubSyncError')}</p>
        {progress.message && (
          <p className="text-xs text-red-500 mt-1">{progress.message}</p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={14} />
          {t('githubRetry')}
        </button>
      )}
    </div>
  );

  const renderImportingState = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <Loader2 size={24} className="text-indigo-600 animate-spin" />
      <p className="text-sm text-slate-600 font-medium">{t('gitHubImporting')}</p>
      {progress.currentFile && (
        <p className="text-xs text-slate-400 truncate max-w-full">{progress.currentFile}</p>
      )}
    </div>
  );

  const renderContent = () => {
    switch (progress.phase) {
      case 'checking':
        return renderCheckingState();
      case 'downloading':
      case 'uploading':
        return renderProgressState();
      case 'importing':
        return renderImportingState();
      case 'completed':
        return renderCompletedState();
      case 'error':
        return renderErrorState();
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
        <Github size={18} className="text-slate-700" />
        <h3 className="font-bold text-sm text-slate-700">{t('gitHubSync')}</h3>
      </div>
      <div className="p-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default GitHubSync;

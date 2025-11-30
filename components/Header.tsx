import React from 'react';
import { ViewState } from '../types';
import { ScrollText, FileCode2, Settings } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface HeaderProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-indigo-200 shadow-md">
          <span className="text-white font-extrabold text-sm tracking-tighter">EG</span>
        </div>
        <h1 className="font-bold text-slate-800 tracking-tight text-sm">{t('appTitle')}</h1>
      </div>
      
      <nav className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
        <button
          onClick={() => setView(ViewState.LIST)}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
            currentView === ViewState.LIST 
              ? 'bg-white text-indigo-600 shadow-sm font-medium' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
          title={t('navMyScripts')}
        >
          <ScrollText size={16} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => setView(ViewState.EDITOR)}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
            currentView === ViewState.EDITOR 
              ? 'bg-white text-indigo-600 shadow-sm font-medium' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
          title={t('navNewScript')}
        >
          <FileCode2 size={16} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => setView(ViewState.SETTINGS)}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
            currentView === ViewState.SETTINGS 
              ? 'bg-white text-indigo-600 shadow-sm font-medium' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
          title={t('navSettings')}
        >
          <Settings size={16} strokeWidth={2.5} />
        </button>
      </nav>
    </header>
  );
};

export default Header;
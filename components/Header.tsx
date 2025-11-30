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
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0 z-10">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-purple-600 rounded-md flex items-center justify-center">
          <span className="text-white font-bold text-xs">GM</span>
        </div>
        <h1 className="font-semibold text-gray-800 tracking-tight">{t('appTitle')}</h1>
      </div>
      
      <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setView(ViewState.LIST)}
          className={`p-1.5 rounded-md transition-all duration-200 ${
            currentView === ViewState.LIST 
              ? 'bg-white text-purple-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
          }`}
          title={t('navMyScripts')}
        >
          <ScrollText size={18} />
        </button>
        <button
          onClick={() => setView(ViewState.EDITOR)}
          className={`p-1.5 rounded-md transition-all duration-200 ${
            currentView === ViewState.EDITOR 
              ? 'bg-white text-purple-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
          }`}
          title={t('navNewScript')}
        >
          <FileCode2 size={18} />
        </button>
        <button
          onClick={() => setView(ViewState.SETTINGS)}
          className={`p-1.5 rounded-md transition-all duration-200 ${
            currentView === ViewState.SETTINGS 
              ? 'bg-white text-purple-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
          }`}
          title={t('navSettings')}
        >
          <Settings size={18} />
        </button>
      </nav>
    </header>
  );
};

export default Header;
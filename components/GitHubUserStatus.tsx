import React, { useState, useRef, useEffect } from 'react';
import { GitHubUser } from '../types';
import { useTranslation } from '../utils/i18n';
import { ChevronDown, User, Github, LogOut, X, Settings } from 'lucide-react';

interface GitHubUserStatusProps {
  user: GitHubUser;
  onLogout: () => void;
  onOpenSettings?: () => void;
}

const GitHubUserStatus: React.FC<GitHubUserStatusProps> = ({ user, onLogout, onOpenSettings }) => {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoutClick = () => {
    setIsDropdownOpen(false);
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const handleOpenSettings = () => {
    setIsDropdownOpen(false);
    onOpenSettings?.();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200"
      >
        <img
          src={user.avatar_url}
          alt={user.login}
          className="w-8 h-8 rounded-full border-2 border-slate-200"
        />
        <span className="text-sm font-medium text-slate-700">{user.login}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
          {user.name && (
            <div className="px-4 py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User size={14} className="text-slate-400" />
                <span className="text-sm text-slate-600">{user.name}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleOpenSettings}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors duration-200"
          >
            <Settings size={14} className="text-slate-400" />
            <span>GitHub {t('sync') || '同步设置'}</span>
          </button>

          <a
            href={user.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors duration-200"
          >
            <Github size={14} className="text-slate-400" />
            <span>GitHub {t('profile') || '主页'}</span>
          </a>

          <div className="border-t border-slate-100 mt-1 pt-1">
            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
            >
              <LogOut size={14} />
              <span>{t('logout') || '登出'}</span>
            </button>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-72 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="font-medium text-slate-800">{t('logout') || '登出'}</span>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm text-slate-600">{t('confirmLogout') || '确定登出吗？'}</p>
            </div>
            <div className="flex gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors duration-200"
              >
                {t('cancel') || '取消'}
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors duration-200"
              >
                {t('confirm') || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubUserStatus;

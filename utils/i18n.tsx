import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../types';
import { getStoredLanguage, setStoredLanguage } from '../services/scriptService';

// 翻译字典
const translations = {
  [Language.EN]: {
    appTitle: 'Script Manager',
    navMyScripts: 'My Scripts',
    navNewScript: 'New Script',
    navSettings: 'Settings',
    
    // Script List
    installedScripts: 'Installed Scripts',
    refresh: 'Refresh',
    noScripts: 'No scripts installed.',
    createOne: 'Create one using the Editor tab.',
    matches: 'Matches',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this script?',

    // Editor
    editorEdit: 'Edit Script',
    editorNew: 'New Script',
    save: 'Save',
    failedToSave: 'Failed to save script.',
    promptPlaceholder: 'Describe what you want the script to do...',
    promptUpdatePlaceholder: 'How should I change this code?',
    thinking: 'Thinking...',
    refine: 'Refine',
    autoCode: 'Auto-Code',
    aiError: 'AI Generation failed. Try again.',
    apiKeyMissing: 'Please set your API Key in Settings first.',
    context: 'Context',
    globalContext: 'Global (No specific site)',
    
    // Settings
    settingsTitle: 'Settings',
    language: 'Language',
    apiKeyTitle: 'Gemini API Key',
    apiKeyDesc: 'Required for the "Auto-Code" feature in the script editor.',
    apiKeyPlaceholder: 'Enter Google AI Studio API Key',
    saveKey: 'Save Key',
    saved: 'Saved',
    devModeTitle: 'Developer Mode',
    devModeDesc: 'Scripts are injected via `chrome.scripting`. Ensure you have enabled Developer Mode in your browser extensions page.',

    // AI Assistant
    aiWelcome: 'Hello! I can help you summarize content or answer questions while you browse.',
    askAi: 'Ask AI...',
    aiErrorConn: 'Sorry, I encountered an error connecting to Gemini. Please try again later.',
    goToSettings: 'Go to Settings',
    configKeyMsg: 'Please configure your API Key in the settings to use the AI assistant.'
  },
  [Language.ZH_CN]: {
    appTitle: '脚本管理器',
    navMyScripts: '我的脚本',
    navNewScript: '新建脚本',
    navSettings: '设置',
    
    installedScripts: '已安装脚本',
    refresh: '刷新',
    noScripts: '暂无已安装脚本。',
    createOne: '请在编辑器中创建一个新脚本。',
    matches: '匹配',
    edit: '编辑',
    delete: '删除',
    confirmDelete: '确定要删除此脚本吗？',

    editorEdit: '编辑脚本',
    editorNew: '新建脚本',
    save: '保存',
    failedToSave: '保存脚本失败。',
    promptPlaceholder: '描述您希望脚本做什么...',
    promptUpdatePlaceholder: '您希望如何修改这段代码？',
    thinking: '思考中...',
    refine: '优化代码',
    autoCode: '自动生成',
    aiError: 'AI 生成失败，请重试。',
    apiKeyMissing: '请先在设置中配置 API Key。',
    context: '上下文',
    globalContext: '全局 (未检测到特定网站)',
    
    settingsTitle: '设置',
    language: '语言',
    apiKeyTitle: 'Gemini API Key',
    apiKeyDesc: '需要在脚本编辑器中使用“自动生成”功能。',
    apiKeyPlaceholder: '输入 Google AI Studio API Key',
    saveKey: '保存 Key',
    saved: '已保存',
    devModeTitle: '开发者模式',
    devModeDesc: '脚本通过 `chrome.scripting` 注入。请确保在浏览器扩展页面启用了开发者模式。',

    aiWelcome: '你好！我可以在你浏览网页时帮你总结内容或回答问题。',
    askAi: '询问 AI...',
    aiErrorConn: '抱歉，连接 Gemini 时出错。请稍后再试。',
    goToSettings: '前往设置',
    configKeyMsg: '请在设置中配置 API Key 以使用 AI 助手。'
  },
  [Language.JA]: {
    appTitle: 'スクリプト管理',
    navMyScripts: 'スクリプト一覧',
    navNewScript: '新規作成',
    navSettings: '設定',
    
    installedScripts: 'インストール済み',
    refresh: '更新',
    noScripts: 'スクリプトがありません。',
    createOne: 'エディタで新しいスクリプトを作成してください。',
    matches: '適用先',
    edit: '編集',
    delete: '削除',
    confirmDelete: 'このスクリプトを削除してもよろしいですか？',

    editorEdit: 'スクリプト編集',
    editorNew: '新規スクリプト',
    save: '保存',
    failedToSave: '保存に失敗しました。',
    promptPlaceholder: 'スクリプトの機能を説明してください...',
    promptUpdatePlaceholder: 'このコードをどのように変更しますか？',
    thinking: '思考中...',
    refine: '改善',
    autoCode: '自動生成',
    aiError: 'AI生成に失敗しました。',
    apiKeyMissing: '設定でAPIキーを設定してください。',
    context: 'コンテキスト',
    globalContext: 'グローバル (特定サイトなし)',
    
    settingsTitle: '設定',
    language: '言語',
    apiKeyTitle: 'Gemini API Key',
    apiKeyDesc: 'エディタの自動生成機能に必要です。',
    apiKeyPlaceholder: 'Google AI Studio API Keyを入力',
    saveKey: '保存',
    saved: '保存完了',
    devModeTitle: '開発者モード',
    devModeDesc: 'スクリプトは `chrome.scripting` 経由で注入されます。ブラウザ拡張機能ページで開発者モードを有効にしてください。',

    aiWelcome: 'こんにちは！ブラウジング中の要約や質問にお答えします。',
    askAi: 'AIに質問...',
    aiErrorConn: 'Geminiへの接続エラーが発生しました。',
    goToSettings: '設定へ移動',
    configKeyMsg: 'AIアシスタントを使用するには、設定でAPIキーを構成してください。'
  },
  [Language.ES]: {
    appTitle: 'Gestor de Scripts',
    navMyScripts: 'Mis Scripts',
    navNewScript: 'Nuevo Script',
    navSettings: 'Ajustes',
    
    installedScripts: 'Scripts Instalados',
    refresh: 'Actualizar',
    noScripts: 'No hay scripts instalados.',
    createOne: 'Crea uno usando la pestaña Editor.',
    matches: 'Coincidencias',
    edit: 'Editar',
    delete: 'Eliminar',
    confirmDelete: '¿Estás seguro de que quieres eliminar este script?',

    editorEdit: 'Editar Script',
    editorNew: 'Nuevo Script',
    save: 'Guardar',
    failedToSave: 'Error al guardar el script.',
    promptPlaceholder: 'Describe qué quieres que haga el script...',
    promptUpdatePlaceholder: '¿Cómo debo cambiar este código?',
    thinking: 'Pensando...',
    refine: 'Refinar',
    autoCode: 'Auto-Código',
    aiError: 'Falló la generación de IA. Inténtalo de nuevo.',
    apiKeyMissing: 'Por favor configura tu API Key en Ajustes primero.',
    context: 'Contexto',
    globalContext: 'Global (Sin sitio específico)',
    
    settingsTitle: 'Ajustes',
    language: 'Idioma',
    apiKeyTitle: 'Gemini API Key',
    apiKeyDesc: 'Requerido para la función "Auto-Código" en el editor.',
    apiKeyPlaceholder: 'Ingresa la Google AI Studio API Key',
    saveKey: 'Guardar Key',
    saved: 'Guardado',
    devModeTitle: 'Modo Desarrollador',
    devModeDesc: 'Los scripts se inyectan vía `chrome.scripting`. Asegúrate de tener activado el Modo Desarrollador.',

    aiWelcome: '¡Hola! Puedo ayudarte a resumir contenido o responder preguntas mientras navegas.',
    askAi: 'Preguntar a la IA...',
    aiErrorConn: 'Lo siento, error al conectar con Gemini.',
    goToSettings: 'Ir a Ajustes',
    configKeyMsg: 'Configura tu API Key en los ajustes para usar el asistente de IA.'
  }
};

type Translations = typeof translations[Language.EN];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to ZH_CN
  const [language, setLanguageState] = useState<Language>(Language.ZH_CN);

  useEffect(() => {
    getStoredLanguage().then(lang => setLanguageState(lang));
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
  };

  const t = (key: keyof Translations): string => {
    return translations[language][key] || translations[Language.EN][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
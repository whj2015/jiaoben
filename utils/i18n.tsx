import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../types';
import { getStoredLanguage, setStoredLanguage } from '../services/scriptService';

const translations = {
  [Language.EN]: {
    appTitle: 'EdgeGenius',
    navMyScripts: 'Scripts',
    navNewScript: 'Create',
    navSettings: 'Settings',
    
    // Script List
    installedScripts: 'Your Scripts',
    refresh: 'Refresh',
    noScripts: 'No scripts found.',
    createOne: 'Create a new script or drag & drop a file here.',
    matches: 'Matches',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this script?',
    import: 'Import',
    exportBackup: 'Backup',
    dragDropTip: 'Drag & Drop .js or .json files here',
    importSuccess: 'Successfully imported {{count}} scripts',
    importError: 'Import failed: ',
    noDescription: 'No description provided',
    loading: 'Loading...',

    // Tab Manager
    openTabs: 'Open Tabs',
    noActiveTabs: 'No active tabs found.',
    closeTab: 'Close Tab',

    // Editor
    editorEdit: 'Edit Script',
    editorNew: 'New Script',
    save: 'Save',
    failedToSave: 'Failed to save.',
    promptPlaceholder: 'Describe functionality...',
    promptUpdatePlaceholder: 'Describe changes...',
    thinking: 'Thinking...',
    refine: 'Refine',
    autoCode: 'Auto',
    aiError: 'AI Error',
    apiKeyMissing: 'Missing API Key',
    context: 'Context',
    globalContext: 'Global',
    exportScript: 'Export File',
    untitledScript: 'Untitled Script',
    
    // History
    history: 'History',
    viewHistory: 'Versions',
    restore: 'Restore',
    restoreConfirm: 'Discard changes and restore?',
    noHistory: 'No history.',
    version: 'Ver',
    compareChanges: 'Compare',
    currentCode: 'Current',
    selectedVersion: 'Selected',
    restoreThis: 'Restore',
    close: 'Close',
    historyCleared: 'Cleared.',
    clearHistory: 'Clear All',
    confirmClearHistory: 'Clear all history?',
    deleteVersion: 'Delete',
    confirmDeleteVersion: 'Delete this version?',
    onlyChanges: 'Diff Only',
    linesHidden: '{{count}} lines hidden',
    showAll: 'Show',
    
    // Settings
    settingsTitle: 'Configuration',
    dataManagement: 'Data Management',
    language: 'Language',
    aiProvider: 'AI Provider',
    apiKeyTitle: 'Google Gemini Key',
    deepseekKeyTitle: 'DeepSeek Key',
    apiKeyDesc: 'For Gemini models.',
    deepseekKeyDesc: 'For DeepSeek-V3.',
    apiKeyPlaceholder: 'Paste Key Here',
    deepseekKeyPlaceholder: 'Paste Key Here',
    saveKey: 'Save',
    saved: 'Saved',
    devModeTitle: 'Developer Mode',
    devModeDesc: 'Required for script injection.',
    
    aiWelcome: 'Hi! I can help you write scripts or answer questions.',
    askAi: 'Ask AI...',
    aiErrorConn: 'Connection error.',
    goToSettings: 'Settings',
    configKeyMsg: 'Set API Key first.'
  },
  [Language.ZH_CN]: {
    appTitle: 'EdgeGenius',
    navMyScripts: '脚本库',
    navNewScript: '新建',
    navSettings: '设置',
    
    installedScripts: '已安装脚本',
    refresh: '刷新',
    noScripts: '暂无脚本',
    createOne: '新建脚本或将 .js 文件拖入此处',
    matches: '匹配',
    edit: '编辑',
    delete: '删除',
    confirmDelete: '确定删除此脚本？',
    import: '导入',
    exportBackup: '备份',
    dragDropTip: '拖拽 .js 或 .json 文件到此处',
    importSuccess: '成功导入 {{count}} 个脚本',
    importError: '导入失败：',
    noDescription: '暂无描述',
    loading: '加载中...',

    // Tab Manager
    openTabs: '已打开标签页',
    noActiveTabs: '未找到活动标签页',
    closeTab: '关闭标签页',

    editorEdit: '编辑脚本',
    editorNew: '新建脚本',
    save: '保存',
    failedToSave: '保存失败',
    promptPlaceholder: '描述脚本功能...',
    promptUpdatePlaceholder: '描述修改需求...',
    thinking: '生成中...',
    refine: '优化',
    autoCode: '自动编写',
    aiError: 'AI 错误',
    apiKeyMissing: '缺少 API Key',
    context: '上下文',
    globalContext: '全局',
    exportScript: '导出文件',
    untitledScript: '无标题脚本',
    
    history: '历史记录',
    viewHistory: '版本历史',
    restore: '恢复',
    restoreConfirm: '丢弃更改并恢复？',
    noHistory: '无记录',
    version: '版本',
    compareChanges: '对比',
    currentCode: '当前',
    selectedVersion: '历史',
    restoreThis: '恢复此版',
    close: '关闭',
    historyCleared: '已清空',
    clearHistory: '清空历史',
    confirmClearHistory: '确定清空所有历史？',
    deleteVersion: '删除',
    confirmDeleteVersion: '删除此版本？',
    onlyChanges: '仅差异',
    linesHidden: '隐藏 {{count}} 行',
    showAll: '展开',
    
    settingsTitle: '设置',
    dataManagement: '数据管理',
    language: '界面语言',
    aiProvider: 'AI 模型',
    apiKeyTitle: 'Google Gemini Key',
    deepseekKeyTitle: 'DeepSeek API Key',
    apiKeyDesc: '用于 Gemini 模型',
    deepseekKeyDesc: '用于 DeepSeek-V3',
    apiKeyPlaceholder: '在此粘贴 Key',
    deepseekKeyPlaceholder: '在此粘贴 Key',
    saveKey: '保存',
    saved: '已保存',
    devModeTitle: '开发者模式',
    devModeDesc: '扩展需要开启开发者模式才能注入脚本。',
    
    aiWelcome: '你好！我是你的 AI 编程助手。',
    askAi: '输入指令...',
    aiErrorConn: '连接错误',
    goToSettings: '去设置',
    configKeyMsg: '请先配置 API Key'
  },
  [Language.JA]: {
    appTitle: 'EdgeGenius',
    navMyScripts: '一覧',
    navNewScript: '作成',
    navSettings: '設定',
    
    installedScripts: 'スクリプト',
    refresh: '更新',
    noScripts: 'スクリプトなし',
    createOne: '新規作成またはファイルをドロップ',
    matches: '適用',
    edit: '編集',
    delete: '削除',
    confirmDelete: '削除しますか？',
    import: 'インポート',
    exportBackup: 'バックアップ',
    dragDropTip: '.js または .json をドロップ',
    importSuccess: '{{count}} 件インポート成功',
    importError: '失敗：',
    noDescription: '説明なし',
    loading: '読み込み中...',

    // Tab Manager
    openTabs: '開いているタブ',
    noActiveTabs: 'アクティブなタブが見つかりません',
    closeTab: 'タブを閉じる',

    editorEdit: '編集',
    editorNew: '新規',
    save: '保存',
    failedToSave: '保存失敗',
    promptPlaceholder: '機能を記述...',
    promptUpdatePlaceholder: '変更内容...',
    thinking: '生成中...',
    refine: '改善',
    autoCode: '自動',
    aiError: 'AIエラー',
    apiKeyMissing: 'キー未設定',
    context: '状況',
    globalContext: '全体',
    exportScript: 'エクスポート',
    untitledScript: '無題のスクリプト',
    
    history: '履歴',
    viewHistory: 'バージョン',
    restore: '復元',
    restoreConfirm: '変更を破棄して復元？',
    noHistory: 'なし',
    version: 'Ver',
    compareChanges: '比較',
    currentCode: '現在',
    selectedVersion: '選択中',
    restoreThis: '復元',
    close: '閉じる',
    historyCleared: 'クリア済',
    clearHistory: '全削除',
    confirmClearHistory: '全履歴を削除？',
    deleteVersion: '削除',
    confirmDeleteVersion: '削除しますか？',
    onlyChanges: '差分のみ',
    linesHidden: '{{count}} 行非表示',
    showAll: '表示',
    
    settingsTitle: '設定',
    dataManagement: 'データ管理',
    language: '言語',
    aiProvider: 'AIプロバイダー',
    apiKeyTitle: 'Google Gemini Key',
    deepseekKeyTitle: 'DeepSeek Key',
    apiKeyDesc: 'Gemini用',
    deepseekKeyDesc: 'DeepSeek用',
    apiKeyPlaceholder: 'キーを入力',
    deepseekKeyPlaceholder: 'キーを入力',
    saveKey: '保存',
    saved: '完了',
    devModeTitle: '開発者モード',
    devModeDesc: 'スクリプト実行に必要です。',
    
    aiWelcome: 'こんにちは！お手伝いします。',
    askAi: 'AIに質問...',
    aiErrorConn: '接続エラー',
    goToSettings: '設定へ',
    configKeyMsg: 'APIキーを設定してください'
  },
  [Language.ES]: {
    appTitle: 'EdgeGenius',
    navMyScripts: 'Scripts',
    navNewScript: 'Crear',
    navSettings: 'Ajustes',
    
    installedScripts: 'Tus Scripts',
    refresh: 'Actualizar',
    noScripts: 'Sin scripts.',
    createOne: 'Crea uno o arrastra un archivo.',
    matches: 'Sitios',
    edit: 'Editar',
    delete: 'Borrar',
    confirmDelete: '¿Eliminar script?',
    import: 'Importar',
    exportBackup: 'Respaldo',
    dragDropTip: 'Arrastra archivos .js o .json',
    importSuccess: '{{count}} importados',
    importError: 'Error: ',
    noDescription: 'Sin descripción',
    loading: 'Cargando...',

    // Tab Manager
    openTabs: 'Pestañas abiertas',
    noActiveTabs: 'No se encontraron pestañas activas',
    closeTab: 'Cerrar pestaña',

    editorEdit: 'Editar',
    editorNew: 'Nuevo',
    save: 'Guardar',
    failedToSave: 'Error al guardar',
    promptPlaceholder: 'Describe la función...',
    promptUpdatePlaceholder: 'Describe cambios...',
    thinking: 'Pensando...',
    refine: 'Refinar',
    autoCode: 'Auto',
    aiError: 'Error AI',
    apiKeyMissing: 'Falta Key',
    context: 'Contexto',
    globalContext: 'Global',
    exportScript: 'Exportar',
    untitledScript: 'Script sin título',
    
    history: 'Historial',
    viewHistory: 'Versiones',
    restore: 'Restaurar',
    restoreConfirm: '¿Descartar cambios y restaurar?',
    noHistory: 'Vacío',
    version: 'Ver',
    compareChanges: 'Comparar',
    currentCode: 'Actual',
    selectedVersion: 'Historial',
    restoreThis: 'Restaurar',
    close: 'Cerrar',
    historyCleared: 'Borrado',
    clearHistory: 'Borrar Todo',
    confirmClearHistory: '¿Borrar todo el historial?',
    deleteVersion: 'Borrar',
    confirmDeleteVersion: '¿Borrar versión?',
    onlyChanges: 'Solo Dif',
    linesHidden: '{{count}} ocultas',
    showAll: 'Mostrar',
    
    settingsTitle: 'Ajustes',
    dataManagement: 'Gestión de Datos',
    language: 'Idioma',
    aiProvider: 'Proveedor AI',
    apiKeyTitle: 'Google Gemini Key',
    deepseekKeyTitle: 'DeepSeek Key',
    apiKeyDesc: 'Para Gemini',
    deepseekKeyDesc: 'Para DeepSeek',
    apiKeyPlaceholder: 'Pega tu Key',
    deepseekKeyPlaceholder: 'Pega tu Key',
    saveKey: 'Guardar',
    saved: 'Guardado',
    devModeTitle: 'Modo Desarrollador',
    devModeDesc: 'Requerido para inyección.',
    
    aiWelcome: '¡Hola! Estoy aquí para ayudar.',
    askAi: 'Preguntar...',
    aiErrorConn: 'Error de conexión',
    goToSettings: 'Ir a Ajustes',
    configKeyMsg: 'Configura la API Key'
  }
};

type Translations = typeof translations[Language.EN];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(Language.ZH_CN);

  useEffect(() => {
    getStoredLanguage().then(lang => setLanguageState(lang));
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
  };

  const t = (key: keyof Translations, params?: Record<string, string>): string => {
    let text = translations[language][key] || translations[Language.EN][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, v);
      });
    }
    return text;
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
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from '../types';
import { streamChatResponse } from '../services/geminiService';
import { Send, Settings } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { escapeHtml } from '../utils/helpers';

// 常量定义
const MAX_INPUT_LENGTH = 5000;

interface AIAssistantProps {
  onRequestSettings?: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ onRequestSettings }) => {
  const { t, language } = useTranslation();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (messages.length === 0 || (messages.length === 1 && messages[0].id === 'welcome')) {
        setMessages([{ id: 'welcome', role: 'model', text: t('aiWelcome') }]);
    }
  }, [language, t]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const sanitizedInput = input.trim().substring(0, MAX_INPUT_LENGTH);
    if (!sanitizedInput) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: sanitizedInput };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', isLoading: true }]);

    abortControllerRef.current = new AbortController();

    try {
      let fullText = '';
      await streamChatResponse(sanitizedInput, (chunk) => {
        fullText += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === modelMsgId 
              ? { ...msg, text: fullText, isLoading: false } 
              : msg
          )
        );
      });
    } catch (error: unknown) {
      console.error('[AIAssistant] Chat error:', error);
      const isMissingKey = error instanceof Error && error.message === 'MISSING_API_KEY';
      
      const errorMsg = isMissingKey 
        ? t('configKeyMsg') 
        : error instanceof Error 
          ? error.message 
          : t('aiErrorConn');
      
      setError(errorMsg);
      
      setMessages(prev => [
        ...prev.filter(m => m.id !== modelMsgId),
        { 
          id: Date.now().toString(), 
          role: 'model', 
          text: errorMsg
        }
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, t]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }, [handleSubmit]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
              } ${msg.text === t('configKeyMsg') ? 'border-red-200 bg-red-50 text-red-800' : ''}`}
            >
              <div dangerouslySetInnerHTML={{ __html: escapeHtml(msg.text) }} />
              
              {msg.text === t('configKeyMsg') && onRequestSettings && (
                <button 
                  onClick={onRequestSettings}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold underline hover:text-red-600"
                >
                  <Settings size={12} /> {t('goToSettings')}
                </button>
              )}

              {msg.isLoading && (
                 <span className="inline-block w-1 h-4 ml-1 align-middle bg-blue-400 animate-pulse"></span>
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-red-50 border border-red-200 text-red-800">
              <div className="flex items-center justify-between gap-2">
                <span>{escapeHtml(error)}</span>
                <button 
                  onClick={() => setError(null)}
                  className="text-red-600 hover:text-red-800 font-bold"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 bg-white">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('askAi')}
            maxLength={MAX_INPUT_LENGTH}
            className="w-full pl-4 pr-12 py-2.5 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-full text-sm transition-all outline-none"
            disabled={isLoading}
            aria-label="Ask AI"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`absolute right-1.5 p-1.5 rounded-full text-white transition-colors ${
              isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIAssistant;

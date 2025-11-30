import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { streamGeminiResponse } from '../services/geminiService';
import { Send, Settings } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface AIAssistantProps {
  onRequestSettings?: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ onRequestSettings }) => {
  const { t, language } = useTranslation();
  
  // Initialize with a function to grab the translation correctly on mount/language change
  // However, since state is persistent, we might want to update the welcome message if language changes
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Effect to set/reset welcome message when language changes if list is empty or has only welcome
  useEffect(() => {
    if (messages.length === 0 || (messages.length === 1 && messages[0].id === 'welcome')) {
        setMessages([{ id: 'welcome', role: 'model', text: t('aiWelcome') }]);
    }
  }, [language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setIsError(false);

    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', isLoading: true }]);

    try {
      let fullText = '';
      await streamGeminiResponse(userMsg.text, (chunk) => {
        fullText += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === modelMsgId 
              ? { ...msg, text: fullText, isLoading: false } 
              : msg
          )
        );
      });
    } catch (error: any) {
      console.error(error);
      const isMissingKey = error.message === 'MISSING_API_KEY';
      setIsError(true);
      
      setMessages(prev => [
        ...prev.filter(m => m.id !== modelMsgId), // Remove empty loading message
        { 
          id: Date.now().toString(), 
          role: 'model', 
          text: isMissingKey 
            ? t('configKeyMsg') 
            : t('aiErrorConn')
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

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
              {msg.text}
              
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
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 bg-white">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('askAi')}
            className="w-full pl-4 pr-12 py-2.5 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-full text-sm transition-all outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`absolute right-1.5 p-1.5 rounded-full text-white transition-colors ${
              isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIAssistant;
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Sparkles, X, Volume2, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import { LifeProfile } from '../types';
import { chatWithAI } from '../services/gemini';
import { cn } from '../utils/cn';

export function ChatBot({ onClose, profile, onPlayTTS, isTTSPlaying }: { onClose: () => void, profile: LifeProfile, onPlayTTS: (t: string) => void, isTTSPlaying: boolean }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
    { role: 'ai', content: `您好，${profile.name}导演。我是您的人生助手，今天想聊聊哪段往事呢？` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const aiMsg = await chatWithAI(userMsg);
      setMessages(prev => [...prev, { role: 'ai', content: aiMsg }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: '抱歉，我现在有点累了，稍后再聊好吗？' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.9 }} 
      animate={{ opacity: 1, y: 0, scale: 1 }} 
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-40 right-4 left-4 md:left-auto md:w-[360px] h-[60vh] max-h-[500px] bg-white rounded-[32px] shadow-2xl border border-[#E6E0D5] flex flex-col overflow-hidden z-50"
    >
      <div className="bg-[#FF8C42] p-4 text-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={20} />
          <span className="font-semibold">人生助手</span>
        </div>
        <button onClick={onClose}><X size={20} /></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FDFBF7]">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' ? "bg-[#FF8C42] text-white rounded-tr-none" : "bg-white border border-[#E6E0D5] text-[#2D2A26] rounded-tl-none shadow-sm"
            )}>
              <Markdown>{msg.content}</Markdown>
            </div>
            {msg.role === 'ai' && (
              <button 
                onClick={() => onPlayTTS(msg.content)}
                className="mt-1 text-[#FF8C42] flex items-center gap-1 text-xs font-medium"
              >
                <Volume2 size={14} className={isTTSPlaying ? "animate-pulse" : ""} /> 朗读
              </button>
            )}
          </div>
        ))}
        {isLoading && <div className="text-xs text-[#8E867A] animate-pulse">正在思考中...</div>}
      </div>

      <div className="p-4 border-t border-[#E6E0D5] flex gap-2">
        <input 
          type="text" 
          className="flex-1 bg-[#FFF9F2] border border-[#E6E0D5] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FF8C42]"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder="想聊点什么？"
        />
        <button onClick={handleSend} className="bg-[#FF8C42] text-white p-2 rounded-xl">
          <ChevronRight size={20} />
        </button>
      </div>
    </motion.div>
  );
}

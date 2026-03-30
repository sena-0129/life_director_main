import React from 'react';
import { motion } from 'motion/react';
import { Video as VideoIcon, BookOpen } from 'lucide-react';

export function StorySuccessPage({ onGenerateVideo, onBackToMuseum }: { onGenerateVideo: () => void, onBackToMuseum: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FDFBF7]"
    >
      <div className="text-6xl mb-6">🎉</div>
      <h2 className="text-3xl font-serif mb-4 text-[#1A1816]">这段故事已经可以生成视频了！</h2>
      <p className="text-[#8E867A] text-lg mb-12">让这段记忆，成为可以被看见的影像。</p>
      
      <div className="w-full max-w-xs space-y-4">
        <button onClick={onGenerateVideo} className="btn-primary w-full py-4 text-xl flex items-center justify-center gap-2">
          <VideoIcon size={24} /> 立即生成视频
        </button>
        <button onClick={onBackToMuseum} className="btn-secondary w-full py-4 text-lg flex items-center justify-center gap-2">
          <BookOpen size={20} /> 返回人生博物馆
        </button>
      </div>
    </motion.div>
  );
}

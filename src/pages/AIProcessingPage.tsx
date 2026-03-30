import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

export function AIProcessingPage() {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="flex-1 flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="relative w-32 h-32 mb-8">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border-4 border-[#FF8C42] border-t-transparent rounded-full"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles size={48} className="text-[#FF8C42]" />
        </div>
      </div>
      <h2 className="mb-4">正在为您整理人生片段...</h2>
      <p className="text-[#8E867A]">AI 正在识别年份、情绪并润色您的故事</p>
    </motion.div>
  );
}

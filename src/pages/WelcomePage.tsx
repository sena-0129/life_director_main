import React from 'react';
import { motion } from 'motion/react';
import { Play, ChevronRight } from 'lucide-react';

export function WelcomePage({ onStart }: { onStart: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FDFBF7] relative"
    >
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#FF8C42] rounded-full blur-[80px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#F27D26] rounded-full blur-[80px]" />
      </div>

      <motion.div 
        initial={{ scale: 0.8, rotate: -10 }}
        animate={{ scale: 1, rotate: 12 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="w-40 h-40 bg-[#FF8C42] rounded-[48px] flex items-center justify-center mb-10 shadow-2xl relative z-10"
      >
        <Play size={80} color="white" fill="white" className="-mr-3" />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 bg-white rounded-[48px] -z-10"
        />
      </motion.div>

      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-6xl font-serif mb-6 tracking-tight text-[#1A1816]"
      >
        人生导演
      </motion.h1>
      
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-[#8E867A] text-2xl tracking-[0.3em] font-light mb-16 uppercase"
      >
        Trace Your Life
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="w-full max-w-xs space-y-4"
      >
        <button onClick={onStart} className="btn-primary w-full py-5 text-2xl">
          开启记录之旅 <ChevronRight size={28} />
        </button>
        <p className="text-[#8E867A] text-sm italic">“每一个平凡的瞬间，都值得被铭记”</p>
      </motion.div>
    </motion.div>
  );
}

import React from 'react';
import { motion } from 'motion/react';
import { Mic, BookOpen, ChevronRight, ChevronLeft } from 'lucide-react';
import { LifeProfile, LifeStory } from '../types';

export function HomePage({ profile, stories, onSelectFree, onSelectInterview, onGoMuseum, onGoProfile, onBackToWelcome }: {
  profile: LifeProfile | null;
  stories: LifeStory[];
  onSelectFree: () => void;
  onSelectInterview: () => void;
  onGoMuseum: () => void;
  onGoProfile: () => void;
  onBackToWelcome: () => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="flex-1 p-8 pb-32 overflow-y-auto"
    >
      <button onClick={onBackToWelcome} className="self-start mb-6 text-[#8E867A] flex items-center gap-1">
        <ChevronLeft /> 返回欢迎页
      </button>

      <header className="flex justify-between items-center mb-12">
        <div>
          <p className="text-[#8E867A] text-sm font-medium">您好，</p>
          <h2 className="text-3xl">{profile?.name} 导演</h2>
        </div>
        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#FF8C42] cursor-pointer" onClick={onGoProfile}>
          <img src={profile?.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
      </header>

      <div className="space-y-6">
        <button 
          onClick={onSelectFree}
          className="w-full card-paper p-10 flex flex-col items-start text-left group hover:bg-[#FF8C42] hover:text-white transition-colors"
        >
          <div className="w-16 h-16 bg-[#FF8C42] group-hover:bg-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <Mic size={32} className="group-hover:text-[#FF8C42]" />
          </div>
          <h3 className="mb-2 group-hover:text-white">自由讲述</h3>
          <p className="text-[#8E867A] group-hover:text-white/80">随心所欲，记录当下的感悟或突发的灵感</p>
        </button>

        <button 
          onClick={onSelectInterview}
          className="w-full card-paper p-10 flex flex-col items-start text-left group hover:bg-[#FF8C42] hover:text-white transition-colors"
        >
          <div className="w-16 h-16 bg-[#FF8C42] group-hover:bg-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <BookOpen size={32} className="group-hover:text-[#FF8C42]" />
          </div>
          <h3 className="mb-2 group-hover:text-white">访谈模式</h3>
          <p className="text-[#8E867A] group-hover:text-white/80">循序渐进，系统回顾人生不同阶段的精彩</p>
        </button>
      </div>

      <div className="mt-12">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xl">人生足迹</h4>
          <button onClick={onGoMuseum} className="text-[#FF8C42] text-sm font-semibold flex items-center">
            查看全部 <ChevronRight size={16} />
          </button>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#E6E0D5]">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-[#8E867A]">已记录故事</p>
              <p className="text-2xl font-serif">{stories.length} 篇</p>
            </div>
            <div className="w-px h-10 bg-[#E6E0D5]"></div>
            <div className="flex-1">
              <p className="text-sm text-[#8E867A]">人生关键词</p>
              <p className="text-lg font-serif">
                {stories.length > 0 ? stories[0].tags[0] : '暂无'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

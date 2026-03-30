import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, History, Video as VideoIcon, Edit2, X, Save, Trash2, Heart, Sparkles, User } from 'lucide-react';
import { LifeStory } from '../types';
import { cn } from '../utils/cn';

export function MuseumPage({ stories, onBack, onDelete, onEdit, onGenerateVideo }: { stories: LifeStory[], onBack: () => void, onDelete: (id: number) => void | Promise<void>, onEdit: (s: LifeStory) => void, onGenerateVideo: (id: number) => void }) {
  const [selectedStory, setSelectedStory] = useState<LifeStory | null>(null);
  const [filterStage, setFilterStage] = useState<string>('全部');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sortedStories = [...stories].sort((a, b) => parseInt(a.year) - parseInt(b.year));
  const filteredStories = sortedStories.filter(s => filterStage === '全部' || s.stage === filterStage);
  
  const STAGES = ['全部', '童年生活', '求学生涯', '初入职场', '爱情故事', '家庭生活', '高光时刻', '自由讲述'];

  // Stats
  const emotionCounts = stories.reduce((acc: any, s) => {
    acc[s.emotion] = (acc[s.emotion] || 0) + 1;
    return acc;
  }, {});
  const topEmotion = Object.entries(emotionCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '无';

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 300, 150);
        const stages = ['童年', '求学', '职场', '爱情', '家庭', '高光'];
        const data = stages.map(st => stories.filter(s => s.stage.includes(st)).length);
        const max = Math.max(...data, 1);
        
        ctx.fillStyle = '#FF8C42';
        data.forEach((val, i) => {
          const h = (val / max) * 100;
          ctx.fillRect(i * 50 + 10, 130 - h, 30, h);
          ctx.fillStyle = '#8E867A';
          ctx.font = '10px sans-serif';
          ctx.fillText(stages[i], i * 50 + 10, 145);
          ctx.fillStyle = '#FF8C42';
        });
      }
    }
  }, [stories]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="flex-1 p-8 pb-32 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-[#8E867A] flex items-center gap-1">
          <ChevronLeft /> 返回
        </button>
        <h2 className="text-2xl">人生博物馆</h2>
      </div>

      {/* Horizontal Stage Filter */}
      <div className="mb-8">
        <div className="flex gap-3 overflow-x-auto pb-4 museum-scroll">
          {STAGES.map(st => (
            <button
              key={st}
              onClick={() => setFilterStage(st)}
              className={cn(
                "flex-shrink-0 px-5 py-2 rounded-full border-2 text-sm font-medium transition-all",
                filterStage === st 
                  ? "border-[#FF8C42] bg-[#FF8C42] text-white shadow-md" 
                  : "border-[#E6E0D5] bg-white text-[#8E867A] hover:border-[#FF8C42]/50"
              )}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Panel */}
      <div className="card-paper p-6 mb-8 bg-white">
        <h4 className="text-lg mb-4">人生数据看板</h4>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#FFF9F2] p-4 rounded-2xl">
            <p className="text-xs text-[#8E867A]">故事总数</p>
            <p className="text-2xl font-serif">{stories.length}</p>
          </div>
          <div className="bg-[#FFF9F2] p-4 rounded-2xl">
            <p className="text-xs text-[#8E867A]">主导情绪</p>
            <p className="text-2xl font-serif">{topEmotion === 'happy' ? '幸福' : topEmotion === 'sad' ? '深沉' : '平静'}</p>
          </div>
        </div>
        <p className="text-xs text-[#8E867A] mb-2">阶段分布图</p>
        <canvas ref={canvasRef} width="300" height="150" className="w-full h-32" />
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[#E6E0D5]"></div>
        <div className="space-y-8">
          {filteredStories.length === 0 ? (
            <div className="text-center py-20 text-[#8E867A] relative z-10">
              <History size={48} className="mx-auto mb-4 opacity-20" />
              <p>{stories.length === 0 ? '暂无记录，快去开启您的第一段故事吧' : '该阶段暂无故事记录'}</p>
            </div>
          ) : (
            filteredStories.map(story => (
              <div key={story.id} className="relative pl-12">
                <div className="absolute left-2.5 top-2 w-3.5 h-3.5 bg-[#FF8C42] rounded-full border-4 border-white shadow-sm"></div>
                <div className="card-paper p-6 transition-transform">
                  <div 
                    onClick={() => setSelectedStory(story)}
                    className="cursor-pointer mb-6"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-bold text-[#FF8C42]">{story.year}年</span>
                      <span className="text-xs bg-[#E6E0D5]/50 px-2 py-0.5 rounded-full text-[#8E867A]">{story.stage}</span>
                    </div>
                    <h3 className="text-xl mb-2 line-clamp-1">{story.title}</h3>
                    <p className="text-[#8E867A] text-sm line-clamp-2 leading-relaxed">{story.content}</p>
                  </div>
                  
                  <div className="flex flex-col gap-3 items-center border-t border-[#E6E0D5] pt-4">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onGenerateVideo(story.id)}
                      className="w-[85%] h-[50px] bg-[#FF8C42] text-white rounded-2xl text-[18px] font-medium shadow-md flex items-center justify-center gap-2 hover:bg-[#F27D26] transition-colors"
                    >
                      <VideoIcon size={22} /> 生成视频
                    </motion.button>
                    <button 
                      onClick={() => onEdit(story)}
                      className="text-[#8E867A] text-sm flex items-center gap-1 hover:text-[#FF8C42] transition-colors"
                    >
                      <Edit2 size={16} /> 编辑
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Story Detail Modal */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end"
          >
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              className="w-full max-w-md mx-auto bg-[#FDFBF7] rounded-t-[40px] max-h-[90vh] overflow-y-auto p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <button onClick={() => setSelectedStory(null)} className="text-[#8E867A]"><X size={24} /></button>
                <div className="flex gap-4">
                  <button onClick={() => { onEdit(selectedStory); setSelectedStory(null); }} className="text-[#8E867A]"><Save size={20} /></button>
                  <button onClick={() => { onDelete(selectedStory.id); setSelectedStory(null); }} className="text-red-400"><Trash2 size={20} /></button>
                </div>
              </div>

              <h2 className="text-3xl mb-4">{selectedStory.title}</h2>
              <div className="flex gap-4 mb-8 text-sm text-[#8E867A]">
                <span className="flex items-center gap-1"><History size={14} /> {selectedStory.year}年</span>
                <span className="flex items-center gap-1"><User size={14} /> {selectedStory.age}岁</span>
                <span className="flex items-center gap-1"><Heart size={14} /> {selectedStory.emotion}</span>
              </div>

              <div className="text-lg leading-relaxed text-[#2D2A26] mb-12 whitespace-pre-wrap">
                {selectedStory.content}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setSelectedStory(null);
                    onGenerateVideo(selectedStory.id);
                  }}
                  className="btn-primary flex-1"
                >
                  生成回忆视频 <VideoIcon size={20} />
                </button>
                <button className="btn-secondary">
                  传记润色 <Sparkles size={20} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Download, MonitorPlay, Film, Check, Video as VideoIcon, X } from 'lucide-react';
import { LifeStory } from '../types';
import { generateLifeVideo } from '../services/gemini';
import { cn } from '../utils/cn';

export function VideoStudioPage({ stories, initialSelectedId, onBack }: { stories: LifeStory[], initialSelectedId: number | null, onBack: () => void }) {
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedId ? [initialSelectedId] : []);
  const [style, setStyle] = useState<'nostalgic' | 'anime'>('nostalgic');
  const [title, setTitle] = useState('我的光辉岁月'); // DEMO MODE PREFILL
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGenerate = async () => {
    if (selectedIds.length === 0) return;
    setIsGenerating(true);
    setErrorText(null);
    
    const selectedStories = stories.filter(s => selectedIds.includes(s.id));
    const combinedContent = selectedStories.map(s => s.content).join('\n\n');
    const firstCover = undefined;

    try {
      const url = await generateLifeVideo(combinedContent, firstCover, "9:16");
      setVideoUrl(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorText(msg || '生成失败');
    }
    
    setIsGenerating(false);
  };

  if (isGenerating) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex-1 flex flex-col items-center justify-center text-center bg-[#1A1816] text-white p-8"
      >
        <div className="relative w-40 h-40 mb-12">
          <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }} 
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-[#FF8C42] rounded-full blur-xl"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-[#FF8C42] rounded-full shadow-[0_0_40px_rgba(255,140,66,0.5)]">
            <VideoIcon size={64} className="text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-serif mb-4 tracking-widest">正在为您拍摄人生片段...</h2>
        <p className="text-[#8E867A] text-lg">AI导演正在剪辑您的专属记忆</p>
      </motion.div>
    );
  }

  if (videoUrl) {
    return (
      <motion.div className="flex-1 flex flex-col bg-[#FDFBF7] p-6">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setVideoUrl(null)} className="text-[#8E867A]"><ChevronLeft size={28} /></button>
          <h2 className="text-2xl font-serif">生成结果</h2>
          <div className="w-7"></div>
        </div>
        <div className="flex-1 bg-black rounded-[32px] overflow-hidden shadow-2xl mb-8 relative">
          <video src={videoUrl} controls autoPlay className="w-full h-full object-contain" />
        </div>
        <div className="flex gap-4 pb-8">
          <a href={videoUrl} download="人生电影.mp4" className="btn-primary flex-1 py-4 text-lg">
            保存到相册 <Download size={20} />
          </a>
          <button onClick={onBack} className="btn-secondary py-4 px-6">
            返回首页
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
      className="flex-1 flex flex-col bg-[#FDFBF7] overflow-hidden relative"
    >
      <div className="p-6 pb-2 shrink-0 bg-white shadow-sm z-10">
        <div className="flex justify-between items-center mb-4">
          <button onClick={onBack} className="text-[#8E867A] flex items-center gap-1">
            <ChevronLeft /> 返回
          </button>
          <h2 className="text-xl font-serif">🎞 人生视频工作台</h2>
          <div className="w-16"></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-48 space-y-8">
        {errorText && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
            {errorText}
          </div>
        )}
        {/* Preview Area */}
        <div className="card-paper p-6 bg-white">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><MonitorPlay size={20} className="text-[#FF8C42]" /> 视频预览</h3>
          <div className="flex gap-4 mb-6">
            <div 
              className="w-[120px] h-[160px] bg-[#E6E0D5] rounded-2xl overflow-hidden shrink-0 shadow-inner relative cursor-pointer group"
              onClick={() => setIsPreviewExpanded(true)}
              role="button"
              tabIndex={0}
            >
              <video 
                src="https://2mk56ovd6z.ucarecd.net/3bc8803d-e388-4843-ace0-76b7ba1d868e/video.mp4" 
                className="w-full h-full object-cover pointer-events-none" 
                autoPlay 
                loop 
                muted 
                playsInline 
                preload="auto"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity pointer-events-none">
                <MonitorPlay size={32} color="white" className="opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </div>
              <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-serif font-bold drop-shadow-md truncate text-center pointer-events-none">
                {title}
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-4">
              <div>
                <label className="text-xs text-[#8E867A] mb-1 block">视频标题</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-[#FDFBF7] border border-[#E6E0D5] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF8C42]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8E867A] mb-2 block">画面风格</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setStyle('nostalgic')}
                    className={cn("flex-1 py-2 text-xs rounded-lg border transition-colors", style === 'nostalgic' ? "border-[#FF8C42] bg-[#FFF9F2] text-[#FF8C42]" : "border-[#E6E0D5] text-[#8E867A]")}
                  >
                    怀旧纪实
                  </button>
                  <button 
                    onClick={() => setStyle('anime')}
                    className={cn("flex-1 py-2 text-xs rounded-lg border transition-colors", style === 'anime' ? "border-[#FF8C42] bg-[#FFF9F2] text-[#FF8C42]" : "border-[#E6E0D5] text-[#8E867A]")}
                  >
                    可爱动漫
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Material Selection */}
        <div>
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Film size={20} className="text-[#FF8C42]" /> 
            {initialSelectedId ? '已选故事素材' : `选择故事素材 (${selectedIds.length})`}
          </h3>
          <div className="space-y-3">
            {stories
              .filter(story => initialSelectedId ? story.id === initialSelectedId : true)
              .map(story => (
              <div 
                key={story.id} 
                onClick={() => !initialSelectedId && toggleSelection(story.id)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all flex items-center gap-4",
                  selectedIds.includes(story.id) ? "border-[#FF8C42] bg-[#FFF9F2]" : "border-[#E6E0D5] bg-white",
                  !initialSelectedId && "cursor-pointer"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                  selectedIds.includes(story.id) ? "border-[#FF8C42] bg-[#FF8C42]" : "border-[#E6E0D5]"
                )}>
                  {selectedIds.includes(story.id) && <Check size={14} color="white" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-[#1A1816] truncate">{story.title}</h4>
                  <p className="text-xs text-[#8E867A] truncate">{story.year}年 · {story.stage}</p>
                </div>
              </div>
            ))}
            {!initialSelectedId && stories.length === 0 && (
              <div className="text-center py-8 text-[#8E867A]">暂无故事素材</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="absolute bottom-[80px] left-0 right-0 p-6 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7] to-transparent pt-12">
        <button 
          onClick={handleGenerate}
          disabled={selectedIds.length === 0}
          className="w-full h-[60px] bg-[#FF8C42] text-white rounded-[20px] text-xl font-medium shadow-xl flex items-center justify-center gap-2 hover:bg-[#F27D26] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          <VideoIcon size={24} /> 生成我的人生短片
        </button>
      </div>

      {/* Expanded Preview Modal */}
      <AnimatePresence>
        {isPreviewExpanded && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsPreviewExpanded(false)}
          >
            <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
              onClick={() => setIsPreviewExpanded(false)}
            >
              <X size={32} />
            </button>
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <video 
                src="https://2mk56ovd6z.ucarecd.net/3bc8803d-e388-4843-ace0-76b7ba1d868e/video.mp4" 
                className="w-full h-full object-contain" 
                controls
                playsInline 
                preload="auto"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

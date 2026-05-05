import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Sparkles, History, User, Heart, Save } from 'lucide-react';
import { LifeStory, Emotion } from '../types';
import { generateEmpathyFeedback } from '../utils/ai-logic';
import { runRag, RagRelatedStory } from '../services/rag';

export function StoryConfirmPage({ story, onSave, onBack }: { story: Partial<LifeStory>, onSave: (s: LifeStory) => void | Promise<void>, onBack: () => void }) {
  const [editedStory, setEditedStory] = useState(story);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [related, setRelated] = useState<RagRelatedStory[]>([]);
  const [enhanceProgress, setEnhanceProgress] = useState(0);
  const enhanceTimer = useRef<number | null>(null);
  const feedback = generateEmpathyFeedback(editedStory.emotion as Emotion);

  useEffect(() => {
    return () => {
      if (enhanceTimer.current) {
        window.clearInterval(enhanceTimer.current);
        enhanceTimer.current = null;
      }
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="flex-1 p-8 pb-32 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-[#8E867A] flex items-center gap-1">
          <ChevronLeft /> 取消
        </button>
        <h3 className="text-xl">整理完成</h3>
      </div>

      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 mb-8 flex gap-4 items-start">
        <div className="w-10 h-10 bg-[#FF8C42] rounded-full flex items-center justify-center shrink-0">
          <Sparkles size={20} color="white" />
        </div>
        <p className="text-[#FF8C42] text-sm italic leading-relaxed">{feedback}</p>
      </div>

      <div className="card-paper p-8 overflow-hidden mb-8">
          <input 
            className="text-2xl font-serif w-full bg-transparent border-b border-transparent focus:border-[#FF8C42] outline-none mb-4"
            value={editedStory.title}
            onChange={e => setEditedStory({ ...editedStory, title: e.target.value })}
          />
          
          <div className="flex gap-4 mb-6 text-sm text-[#8E867A]">
            <span className="flex items-center gap-1"><History size={14} /> {editedStory.year}年</span>
            <span className="flex items-center gap-1"><User size={14} /> {editedStory.age}岁</span>
            <span className="flex items-center gap-1"><Heart size={14} /> {editedStory.emotion === 'happy' ? '开心' : editedStory.emotion === 'sad' ? '难过' : '平静'}</span>
          </div>

          <textarea 
            className="w-full h-64 bg-transparent outline-none resize-none text-lg leading-relaxed"
            value={editedStory.content}
            onChange={e => setEditedStory({ ...editedStory, content: e.target.value })}
          />

          <div className="flex flex-wrap gap-2 mt-6">
            {editedStory.tags?.map(tag => (
              <span key={tag} className="bg-[#E6E0D5]/50 px-3 py-1 rounded-full text-xs text-[#8E867A]">#{tag}</span>
            ))}
          </div>
      </div>

      <button
        onClick={async () => {
          const userId = String((editedStory as any).profileId || '');
          const userInput = String(editedStory.content || '');
          if (!userId) {
            window.alert('缺少用户ID，无法运行补全');
            return;
          }
          if (!userInput) {
            window.alert('内容为空，无法运行补全');
            return;
          }
          if (isEnhancing) return;
          setIsEnhancing(true);
          setEnhanceProgress(8);
          if (enhanceTimer.current) {
            window.clearInterval(enhanceTimer.current);
            enhanceTimer.current = null;
          }
          enhanceTimer.current = window.setInterval(() => {
            setEnhanceProgress((p) => {
              if (p >= 90) return p;
              const step = p < 30 ? 3 : p < 60 ? 2 : 1;
              return Math.min(90, p + step);
            });
          }, 600);
          try {
            const r = await runRag(userId, userInput, 3);
            setEditedStory({ ...editedStory, content: r.enhanced });
            setRelated(r.relatedStories || []);
            setEnhanceProgress(100);
          } catch (e: any) {
            window.alert(e?.message || '补全失败，请稍后重试');
          } finally {
            if (enhanceTimer.current) {
              window.clearInterval(enhanceTimer.current);
              enhanceTimer.current = null;
            }
            window.setTimeout(() => setEnhanceProgress(0), 800);
            setIsEnhancing(false);
          }
        }}
        className="btn-secondary w-full mb-3"
        disabled={isEnhancing}
      >
        {isEnhancing ? '正在补全...' : '基于记忆补全'}
      </button>

      {(isEnhancing || enhanceProgress > 0) && (
        <div className="bg-white/70 border border-[#E6E0D5] rounded-2xl p-4 mb-6">
          <div className="text-sm text-[#8E867A] mb-3">生成需要一小会儿时间，请您耐心等待</div>
          <div className="h-2 rounded-full bg-[#E6E0D5] overflow-hidden">
            <div className="h-full bg-[#FF8C42] transition-all" style={{ width: `${enhanceProgress}%` }} />
          </div>
          <div className="text-xs text-[#8E867A] mt-2">{enhanceProgress}%</div>
        </div>
      )}

      {related.length > 0 && (
        <div className="bg-white/70 border border-[#E6E0D5] rounded-2xl p-4 mb-6">
          <div className="text-sm text-[#8E867A] mb-2">本次参考的相关记忆</div>
          <div className="space-y-3">
            {related.map((s) => (
              <div key={s.id} className="text-sm text-[#1A1816]">
                <div className="text-xs text-[#8E867A] mb-1">
                  {s.year ? `${s.year}年` : '未知年份'} · 相似度 {s.score.toFixed(3)}
                </div>
                <div className="line-clamp-3 whitespace-pre-wrap">{s.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button 
        onClick={async () => {
          if (isSaving) return;
          setIsSaving(true);
          try {
            await onSave({ ...editedStory, id: editedStory.id || Date.now(), timestamp: Date.now() } as LifeStory);
          } finally {
            setIsSaving(false);
          }
        }}
        className="btn-primary w-full"
        disabled={isSaving}
      >
        {isSaving ? '正在保存...' : '保存到博物馆'} <Save />
      </button>
    </motion.div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Mic, ChevronRight } from 'lucide-react';
import { INTERVIEW_STAGES } from '../types';
import { cn } from '../utils/cn';

export function InterviewPage({ onBack, onFinish }: { onBack: () => void, onFinish: (c: string, s: string) => void }) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('那是一个阳光明媚的下午，我第一次感受到了责任的重量。虽然当时条件艰苦，但如今回想起来，那是我人生中最宝贵的财富。'); // DEMO MODE PREFILL
  const [isRecording, setIsRecording] = useState(false);

  const stages = Object.entries(INTERVIEW_STAGES);

  const handleNext = () => {
    const newAnswers = [...answers, currentAnswer];
    setAnswers(newAnswers);
    setCurrentAnswer('那是一个阳光明媚的下午，我第一次感受到了责任的重量。虽然当时条件艰苦，但如今回想起来，那是我人生中最宝贵的财富。'); // DEMO MODE PREFILL

    const questions = (INTERVIEW_STAGES as any)[selectedStage!].questions;
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onFinish(newAnswers.join('\n'), (INTERVIEW_STAGES as any)[selectedStage!].label);
    }
  };

  const handleSkip = () => {
    const newAnswers = [...answers, "（略过）"];
    setAnswers(newAnswers);
    setCurrentAnswer('那是一个阳光明媚的下午，我第一次感受到了责任的重量。虽然当时条件艰苦，但如今回想起来，那是我人生中最宝贵的财富。'); // DEMO MODE PREFILL

    const questions = (INTERVIEW_STAGES as any)[selectedStage!].questions;
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onFinish(newAnswers.join('\n'), (INTERVIEW_STAGES as any)[selectedStage!].label);
    }
  };

  if (!selectedStage) {
    return (
      <motion.div 
        initial={{ x: '100%' }} 
        animate={{ x: 0 }} 
        exit={{ x: '-100%' }}
        className="flex-1 p-8 overflow-y-auto"
      >
        <button onClick={onBack} className="self-start mb-8 text-[#8E867A] flex items-center gap-1">
          <ChevronLeft /> 返回
        </button>
        <h2 className="mb-8">选择人生阶段</h2>
        <div className="grid grid-cols-1 gap-4">
          {stages.map(([key, value]) => (
            <button 
              key={key}
              onClick={() => setSelectedStage(key)}
              className="card-paper p-6 text-left hover:border-[#FF8C42] transition-all"
            >
              <h3 className="text-xl mb-1">{value.label}</h3>
              <p className="text-sm text-[#8E867A] italic">{value.guide}</p>
            </button>
          ))}
        </div>
      </motion.div>
    );
  }

  const stageData = (INTERVIEW_STAGES as any)[selectedStage];
  const question = stageData.questions[currentQuestionIndex];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="flex-1 flex flex-col p-8 bg-[#FDFBF7]"
    >
      <div className="flex justify-between items-center mb-12">
        <button onClick={() => setSelectedStage(null)} className="text-[#8E867A] flex items-center gap-1">
          <ChevronLeft /> 重新选择
        </button>
        <span className="text-sm font-bold text-[#FF8C42]">{currentQuestionIndex + 1} / {stageData.questions.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={currentQuestionIndex}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="flex-1 flex flex-col"
        >
          <h2 className="text-3xl mb-12 font-serif leading-tight">“{question}”</h2>
          
          <textarea 
            className="w-full flex-1 card-paper p-6 text-xl outline-none resize-none mb-8"
            value={currentAnswer}
            onChange={e => setCurrentAnswer(e.target.value)}
            placeholder="请在这里回答..."
          />

          <div className="flex gap-4">
            <button 
              onClick={() => setIsRecording(!isRecording)}
              className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                isRecording ? "bg-red-500" : "bg-[#E6E0D5]"
              )}
            >
              <Mic size={32} color={isRecording ? "white" : "#2D2A26"} />
            </button>
            <div className="flex-1 flex gap-2">
              <button 
                onClick={handleSkip}
                className="btn-secondary flex-1"
              >
                略过
              </button>
              <button 
                onClick={handleNext}
                disabled={!currentAnswer.trim()}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                下一题 <ChevronRight />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

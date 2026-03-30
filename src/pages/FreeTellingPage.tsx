import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Mic, ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';

export function FreeTellingPage({ onBack, onFinish }: { onBack: () => void, onFinish: (c: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [text, setText] = useState('那是在1978年的秋天，我刚刚恢复高考考入北京师范大学。那时的条件虽然艰苦，但每个人眼里都闪烁着对知识的渴望。我还记得拿到录取通知书的那天，全家人激动得一晚上没睡着觉。那是我人生中最难忘的转折点。'); // DEMO MODE PREFILL
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            setText(prev => prev + event.results[i][0].transcript);
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
      };
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
    setIsRecording(!isRecording);
  };

  return (
    <motion.div 
      initial={{ y: '100%' }} 
      animate={{ y: 0 }} 
      exit={{ y: '100%' }}
      className="flex-1 flex flex-col p-8 bg-[#FDFBF7]"
    >
      <button onClick={onBack} className="self-start mb-8 text-[#8E867A] flex items-center gap-1">
        <ChevronLeft /> 返回
      </button>
      
      <h2 className="mb-4">自由讲述</h2>
      <p className="text-[#8E867A] mb-8">点击麦克风开始说话，或者直接在下方输入文字。</p>

      <div className="flex-1 flex flex-col items-center justify-center gap-12">
        <div className="relative">
          {isRecording && (
            <div className="absolute inset-0 flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-1.5 bg-[#FF8C42] rounded-full animate-wave" 
                  style={{ height: '40px', animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          )}
          <button 
            onClick={toggleRecording}
            className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all relative z-10",
              isRecording ? "bg-red-500 scale-110" : "bg-[#FF8C42]"
            )}
          >
            <Mic size={48} color="white" />
          </button>
        </div>

        <textarea 
          className="w-full flex-1 card-paper p-6 text-xl outline-none resize-none"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="您的故事将在这里呈现..."
        />

        <button 
          onClick={() => onFinish(text)} 
          disabled={!text.trim()}
          className="btn-primary w-full disabled:opacity-50"
        >
          完成记录 <ChevronRight />
        </button>
      </div>
    </motion.div>
  );
}

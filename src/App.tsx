/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  History, 
  User, 
  MessageCircle, 
  Film,
  X
} from 'lucide-react';
import { AppStage, LifeProfile, LifeStory } from './types';
import { storage } from './utils/storage';
import { processStory } from './utils/ai-logic';
import { textToSpeech } from './services/gemini';
import confetti from 'canvas-confetti';
import { cn } from './utils/cn';

import { WelcomePage } from './pages/WelcomePage';
import { ProfilePage } from './pages/ProfilePage';
import { HomePage } from './pages/HomePage';
import { FreeTellingPage } from './pages/FreeTellingPage';
import { InterviewPage } from './pages/InterviewPage';
import { AIProcessingPage } from './pages/AIProcessingPage';
import { StoryConfirmPage } from './pages/StoryConfirmPage';
import { MuseumPage } from './pages/MuseumPage';
import { StorySuccessPage } from './pages/StorySuccessPage';
import { VideoStudioPage } from './pages/VideoStudioPage';
import { ChatBot } from './pages/ChatBot';

export default function App() {
  const [stage, setStage] = useState<AppStage>('welcome');
  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [profiles, setProfiles] = useState<LifeProfile[]>([]);
  const [stories, setStories] = useState<LifeStory[]>([]);
  const [currentDraft, setCurrentDraft] = useState<string>('');
  const [currentStage, setCurrentStage] = useState<string>('');
  const [processedStory, setProcessedStory] = useState<Partial<LifeStory> | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      await storage.migrateLocalToBackendOnce();
      const activeProfile = await storage.getActiveProfile();
      const allProfiles = await storage.getProfiles();
      setProfiles(allProfiles);

      if (activeProfile) {
        setProfile(activeProfile);
        setStories(await storage.getStories(activeProfile.id));
        setStage('home');
      }
    })();
  }, []);

  const handleSaveProfile = async (newProfile: LifeProfile) => {
    const profileToSave = { ...newProfile, id: newProfile.id || Date.now().toString() };
    const saved = await storage.saveProfile(profileToSave);
    setProfile(saved);
    setProfiles(await storage.getProfiles());
    setStage('home');
  };

  const handleSwitchProfile = async (id: string) => {
    await storage.setActiveProfile(id);
    const activeProfile = await storage.getActiveProfile();
    if (activeProfile) {
      setProfile(activeProfile);
      setStories(await storage.getStories(activeProfile.id));
      setStage('home');
    }
  };

  const handleCreateNewProfile = () => {
    setProfile(null);
    setStage('profile');
  };

  const handleFinishRecording = (content: string, stageName: string) => {
    setCurrentDraft(content);
    setCurrentStage(stageName);
    setStage('ai-processing');
    
    // Simulate AI processing
    setTimeout(() => {
      if (profile) {
        const result = processStory(content, stageName, profile.birthDate);
        setProcessedStory({ ...result, profileId: profile.id });
        setStage('story-confirm');
      }
    }, 3000);
  };

  const handleSaveStory = async (story: LifeStory) => {
    if (!profile) return;
    try {
      const storyToSave = { ...story, profileId: profile.id };
      const saved = await storage.saveStory(storyToSave);
      setStories(await storage.getStories(profile.id));
      setSelectedStoryId(saved.id);
      setStage('story-success');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF8C42', '#FFF9F2', '#F27D26']
      });
    } catch (e: any) {
      window.alert(e?.message || '保存失败，请稍后重试');
    }
  };

  const playTTS = async (text: string) => {
    if (isTTSPlaying) {
      audioRef.current?.pause();
      setIsTTSPlaying(false);
      return;
    }

    setIsTTSPlaying(true);
    const audioUrl = await textToSpeech(text);
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsTTSPlaying(false);
      audio.play();
    } else {
      setIsTTSPlaying(false);
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto relative overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {stage === 'welcome' && <WelcomePage onStart={() => setStage('profile')} />}
        {stage === 'profile' && (
          <ProfilePage 
            onSave={handleSaveProfile} 
            initialData={profile} 
            onBack={() => setStage(profile ? 'home' : 'welcome')}
            onSwitch={handleSwitchProfile}
            profiles={profiles}
            onCreateNew={handleCreateNewProfile}
          />
        )}
        {stage === 'home' && (
          <HomePage 
            profile={profile} 
            stories={stories}
            onSelectFree={() => setStage('free-telling')} 
            onSelectInterview={() => setStage('interview')}
            onGoMuseum={() => setStage('museum')}
            onGoProfile={() => setStage('profile')}
            onBackToWelcome={() => setStage('welcome')}
          />
        )}
        {stage === 'free-telling' && (
          <FreeTellingPage 
            onBack={() => setStage('home')} 
            onFinish={(content) => handleFinishRecording(content, '自由讲述')} 
          />
        )}
        {stage === 'interview' && (
          <InterviewPage 
            onBack={() => setStage('home')} 
            onFinish={handleFinishRecording} 
          />
        )}
        {stage === 'ai-processing' && <AIProcessingPage />}
        {stage === 'story-confirm' && (
          <StoryConfirmPage 
            story={processedStory!} 
            onSave={handleSaveStory} 
            onBack={() => setStage('home')} 
          />
        )}
        {stage === 'story-success' && (
          <StorySuccessPage 
            onGenerateVideo={() => setStage('video-studio')}
            onBackToMuseum={() => setStage('museum')}
          />
        )}
        {stage === 'video-studio' && (
          <VideoStudioPage 
            stories={stories}
            initialSelectedId={selectedStoryId}
            onBack={() => setStage('museum')}
          />
        )}
        {stage === 'museum' && (
          <MuseumPage 
            stories={stories} 
            onBack={() => setStage('home')} 
            onDelete={async (id) => {
              await storage.deleteStory(id);
              if (profile) setStories(await storage.getStories(profile.id));
            }}
            onEdit={(story) => {
              setProcessedStory(story);
              setStage('story-confirm');
            }}
            onGenerateVideo={(id) => {
              setSelectedStoryId(id);
              setStage('video-studio');
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating Chatbot */}
      {profile && stage !== 'welcome' && stage !== 'profile' && (
        <>
          <div className="fixed bottom-24 right-4 z-50">
            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="w-14 h-14 bg-[#FF8C42] text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
            >
              {isChatOpen ? <X size={28} /> : <MessageCircle size={28} />}
            </button>
          </div>
          
          <AnimatePresence>
            {isChatOpen && (
              <ChatBot 
                onClose={() => setIsChatOpen(false)} 
                profile={profile} 
                onPlayTTS={playTTS}
                isTTSPlaying={isTTSPlaying}
              />
            )}
          </AnimatePresence>
        </>
      )}

      {/* Bottom Nav (Only for Home, Museum, and Video Studio) */}
      {(stage === 'home' || stage === 'museum' || stage === 'video-studio') && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-[#E6E0D5] px-8 py-4 flex justify-around items-center z-40">
          <button 
            onClick={() => setStage('home')}
            className={cn("flex flex-col items-center gap-1", stage === 'home' ? "text-[#FF8C42]" : "text-[#8E867A]")}
          >
            <BookOpen size={24} />
            <span className="text-xs font-medium">首页</span>
          </button>
          <button 
            onClick={() => setStage('museum')}
            className={cn("flex flex-col items-center gap-1", stage === 'museum' ? "text-[#FF8C42]" : "text-[#8E867A]")}
          >
            <History size={24} />
            <span className="text-xs font-medium">博物馆</span>
          </button>
          <button 
            onClick={() => setStage('video-studio')}
            className={cn("flex flex-col items-center gap-1", stage === 'video-studio' ? "text-[#FF8C42]" : "text-[#8E867A]")}
          >
            <Film size={24} />
            <span className="text-xs font-medium">视频</span>
          </button>
          <button 
            onClick={() => setStage('profile')}
            className="flex flex-col items-center gap-1 text-[#8E867A]"
          >
            <User size={24} />
            <span className="text-xs font-medium">档案</span>
          </button>
        </nav>
      )}
    </div>
  );
}

// --- Sub-components ---

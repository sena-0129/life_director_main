import { Emotion, LifeStory } from '../types';

const happyWords = ["开心", "幸福", "快乐", "骄傲", "自豪", "甜蜜", "浪漫", "温暖", "感激"];
const sadWords = ["难过", "遗憾", "失去", "痛苦", "孤独", "迷茫", "后悔", "辛酸", "眼泪"];

export function detectEmotion(content: string): Emotion {
  let happyCount = 0;
  let sadCount = 0;

  happyWords.forEach(word => {
    if (content.includes(word)) happyCount++;
  });

  sadWords.forEach(word => {
    if (content.includes(word)) sadCount++;
  });

  if (happyCount > sadCount) return 'happy';
  if (sadCount > happyCount) return 'sad';
  return 'neutral';
}

export function extractYear(content: string): string {
  const yearMatch = content.match(/(19\d{2}|20\d{2})/);
  return yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
}

export function calculateAge(birthDate: string, storyYear: string): number {
  const birthYear = new Date(birthDate).getFullYear();
  const year = parseInt(storyYear);
  return isNaN(birthYear) || isNaN(year) ? 0 : year - birthYear;
}

export function generateTitle(content: string, stage: string): string {
  if (stage) return stage;
  // Extract first sentence or first 10 characters
  const firstSentence = content.split(/[。！？]/)[0];
  return firstSentence.length > 15 ? firstSentence.substring(0, 15) + '...' : firstSentence || '人生片段';
}

export function polishContent(content: string): string {
  // Simple polishing: remove extra spaces, fix some common punctuation
  return content.trim().replace(/\s+/g, ' ').replace(/,,/g, '，').replace(/\.\./g, '...');
}

export function generateEmpathyFeedback(emotion: Emotion): string {
  switch (emotion) {
    case 'happy':
      return "听到这里，我能感受到那段时光对您非常重要，充满了幸福的色彩。";
    case 'sad':
      return "这段回忆虽然带着些许忧伤，但正是这些经历沉淀成了您人生中宝贵的财富。";
    default:
      return "感谢您的分享，这些平凡而真实的瞬间，构成了您独一无二的人生故事。";
  }
}

export function processStory(content: string, stage: string, birthDate: string): Partial<LifeStory> {
  const year = extractYear(content);
  const emotion = detectEmotion(content);
  const age = calculateAge(birthDate, year);
  const title = generateTitle(content, stage);
  const polished = polishContent(content);

  return {
    title,
    stage,
    year,
    age,
    emotion,
    content: polished,
    tags: [stage, emotion === 'happy' ? '温暖' : emotion === 'sad' ? '深沉' : '真实'],
  };
}

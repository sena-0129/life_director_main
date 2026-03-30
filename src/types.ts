export type Emotion = 'happy' | 'sad' | 'neutral';

export interface LifeProfile {
  id: string;
  name: string;
  birthDate: string;
  birthPlace: string;
  gender: string;
  occupation: string;
  cities: string[];
  avatar: string;
  bio: string;
}

export interface LifeStory {
  id: number;
  profileId: string;
  title: string;
  stage: string;
  year: string;
  age: number;
  emotion: Emotion;
  tags: string[];
  content: string;
  timestamp: number;
}

export type AppStage = 'welcome' | 'profile' | 'home' | 'free-telling' | 'interview' | 'museum' | 'ai-processing' | 'story-confirm' | 'story-success' | 'video-studio';

export const INTERVIEW_STAGES = {
  childhood: {
    label: '童年生活',
    guide: '“那些模糊却温暖的记忆”',
    questions: [
      "你还记得小时候第一次离开家吗？",
      "小时候家里是什么样的？",
      "最难忘的一天是哪天？"
    ]
  },
  school: {
    label: '求学生涯',
    guide: '“在书本与操场间成长的日子”',
    questions: [
      "你最好的朋友是谁？",
      "有没有一刻让你突然成长？",
      "最喜欢的老师是谁？"
    ]
  },
  career: {
    label: '初入职场',
    guide: '“第一份薪水，第一次挑战”',
    questions: [
      "你的第一份工作是什么？",
      "职场中最有成就感的瞬间？",
      "有没有遇到过对你影响很大的人？"
    ]
  },
  love: {
    label: '爱情故事',
    guide: '“心动与相守的岁月”',
    questions: [
      "第一次心动是什么感觉？",
      "你们是怎么认识的？",
      "最浪漫的一次约会是在哪里？"
    ]
  },
  family: {
    label: '家庭生活',
    guide: '“柴米油盐中的温情”',
    questions: [
      "孩子出生那天，你在想什么？",
      "家里最热闹的时候是什么样？",
      "你最想对家人说的一句话？"
    ]
  },
  highlights: {
    label: '高光时刻',
    guide: '“那些闪闪发光的日子”',
    questions: [
      "你人生中最自豪的一件事？",
      "如果可以回到过去，你想回到哪一刻？",
      "你觉得人生最大的收获是什么？"
    ]
  }
};

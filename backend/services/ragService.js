import { getEmbedding } from './embeddingService.js';
import { getUserStories } from './memoryService.js';
import { cosineSimilarity } from '../utils/similarity.js';

/**
 * 构建 RAG Prompt：把用户输入 + 相关记忆拼接为可直接喂给 LLM 的文本。
 */
export function buildPrompt(userInput, relatedStories) {
  const memories = relatedStories
    .map((s, idx) => {
      const tags = Array.isArray(s.tags) && s.tags.length ? `标签：${s.tags.join('、')}` : '标签：无';
      const year = s.year ? `年份：${s.year}` : '年份：未知';
      return `记忆${idx + 1}\n${year}\n${tags}\n内容：${s.content}`;
    })
    .join('\n\n');

  return [
    '你是一位“人生故事整理助手”，语气温暖、有陪伴感，但绝不编造事实。',
    '任务：把用户刚刚的输入整理成一段更清晰、更有叙事性的回忆文字，并在不改变事实的前提下，结合下面提供的“相关记忆”补全语境（仅限用户曾提到的内容）。',
    '要求：',
    '1) 不要凭空添加人物、地点、事件细节；不确定就保持模糊或用提问方式提示。',
    '2) 输出用简洁中文，分段清晰（2-4段）。',
    '3) 如果相关记忆与当前输入有冲突，优先以当前输入为准，并用一句温和的话提示可能的差异。',
    '',
    `用户输入：\n${userInput}`,
    '',
    `相关记忆：\n${memories || '（无）'}`,
    '',
    '请输出：增强后的故事正文（不要输出分析过程）。',
  ].join('\n');
}

/**
 * 语义检索：用 userInput embedding 和用户历史 stories embedding 做 cosine 相似度，取 Top-K。
 */
export async function retrieveRelatedStories({ userId, userInput, topK = 3 }) {
  const inputEmbedding = await getEmbedding(userInput);
  if (!inputEmbedding) return { inputEmbedding: null, relatedStories: [] };

  const stories = await getUserStories(userId);
  const scored = stories
    .filter((s) => Array.isArray(s.embedding) && s.embedding.length === inputEmbedding.length)
    .map((s) => ({
      ...s,
      score: cosineSimilarity(inputEmbedding, s.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    inputEmbedding,
    relatedStories: scored,
    totalStories: stories.length,
    embeddedStories: stories.filter((s) => Array.isArray(s.embedding) && s.embedding.length === inputEmbedding.length).length,
    embeddingDimensions: inputEmbedding.length,
  };
}

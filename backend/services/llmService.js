import { requireEnv, getEnv } from '../config/env.js';

/**
 * 调用 OpenAI Chat Completions 生成增强后的故事文本。
 */
export async function generateStory(prompt) {
  const baseURL = getEnv('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  const apiKey = requireEnv('DASHSCOPE_API_KEY');
  const model = requireEnv('DASHSCOPE_CHAT_MODEL');

  const resp = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是一位温暖、克制、不会编造事实的人生故事整理助手。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${text}`.trim());
  }
  const data = await resp.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

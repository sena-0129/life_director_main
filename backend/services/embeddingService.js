import { requireEnv, getEnv } from '../config/env.js';

/**
 * 调用 OpenAI Embeddings API 获取向量。
 * 默认模型：text-embedding-3-small（1536 维）。
 */
export async function getEmbedding(text) {
  const baseURL = getEnv('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  const apiKey = requireEnv('DASHSCOPE_API_KEY');
  const model = requireEnv('DASHSCOPE_EMBEDDING_MODEL');
  const dimensionsRaw = getEnv('DASHSCOPE_EMBEDDING_DIMENSIONS');
  const dimensions = dimensionsRaw ? Number(dimensionsRaw) : undefined;
  const input = (text || '').toString();

  const resp = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      ...(dimensions && Number.isFinite(dimensions) ? { dimensions } : {}),
      encoding_format: 'float',
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${text}`.trim());
  }
  const data = await resp.json();
  return data?.data?.[0]?.embedding || null;
}

import { createSupabaseAdminClient } from '../lib/supabaseClient.js';
import { getEmbedding } from './embeddingService.js';
import { parseEmbedding } from '../utils/similarity.js';

let supabase = null;

function sb() {
  if (supabase) return supabase;
  supabase = createSupabaseAdminClient();
  return supabase;
}

/**
 * 新增故事（记忆）并尽可能把 embedding 一并写入数据库。
 * userId 对应 Supabase 的 stories.profile_id（本项目用 profile 表作为用户标识）。
 */
export async function addStory({ userId, content, tags, year }) {
  const embedding = await getEmbedding(content);
  const now = Date.now();

  const row = {
    profile_id: userId,
    title: '用户故事',
    stage: 'RAG',
    year: year ? String(year) : new Date().getFullYear().toString(),
    age: 0,
    emotion: 'neutral',
    tags: Array.isArray(tags) ? tags : [],
    content: String(content || ''),
    timestamp: now,
    embedding,
  };

  let data = null;
  let error = null;
  let embeddingStored = true;
  ({ data, error } = await sb().from('stories').insert(row).select('*').single());
  if (error && typeof error.message === 'string' && error.message.includes('embedding')) {
    const fallbackRow = { ...row };
    delete fallbackRow.embedding;
    embeddingStored = false;
    ({ data, error } = await sb().from('stories').insert(fallbackRow).select('*').single());
  }
  if (error) throw error;
  return {
    id: data.id,
    userId: data.profile_id,
    year: data.year,
    tags: data.tags,
    content: data.content,
    embeddingStored,
    embeddingDimensions: Array.isArray(embedding) ? embedding.length : null,
    embedding: parseEmbedding(data.embedding) || embedding,
    createdAt: data.created_at,
  };
}

/**
 * 获取该用户的所有 stories（尽可能返回 embedding；若数据库无 embedding 列或为 null，则 embedding 为空）。
 */
export async function getUserStories(userId) {
  let data = null;
  let error = null;
  ({ data, error } = await sb()
    .from('stories')
    .select('id, profile_id, year, tags, content, embedding, created_at')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false }));
  if (error && typeof error.message === 'string' && error.message.includes('embedding')) {
    ({ data, error } = await sb()
      .from('stories')
      .select('id, profile_id, year, tags, content, created_at')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false }));
  }
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    userId: r.profile_id,
    year: r.year,
    tags: r.tags,
    content: r.content,
    embedding: parseEmbedding(r.embedding),
    createdAt: r.created_at,
  }));
}

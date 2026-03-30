import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json({ limit: '25mb' }));

const backendToken = process.env.BACKEND_TOKEN;
if (backendToken) {
  app.use((req, res, next) => {
    if (req.path === '/api/health') {
      next();
      return;
    }
    const auth = String(req.headers.authorization || '');
    const expected = `Bearer ${backendToken}`;
    if (auth !== expected) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getDashscopeConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const embeddingModel = process.env.DASHSCOPE_EMBEDDING_MODEL || 'text-embedding-v4';
  const embeddingDimensions = process.env.DASHSCOPE_EMBEDDING_DIMENSIONS ? Number(process.env.DASHSCOPE_EMBEDDING_DIMENSIONS) : 1024;
  const chatModel = process.env.DASHSCOPE_CHAT_MODEL || 'qwen3.5-plus';
  return { apiKey, baseUrl, embeddingModel, embeddingDimensions, chatModel };
}

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(',')}]`;
}

function parseVector(value: any) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map((n) => Number(n));
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map((p) => Number(p.trim()));
    }
  }
  return null;
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function buildRagPrompt(userInput: string, relatedStories: Array<{ year?: string; tags?: any; content: string }>) {
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

async function dashscopeEmbedding(text: string) {
  const { apiKey, baseUrl, embeddingModel, embeddingDimensions } = getDashscopeConfig();
  if (!apiKey) return null;
  const resp = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: text,
      dimensions: embeddingDimensions,
      encoding_format: 'float',
    }),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${msg}`.trim());
  }
  const data = await resp.json();
  return (data?.data?.[0]?.embedding as number[] | undefined) || null;
}

async function dashscopeChat(prompt: string) {
  const { apiKey, baseUrl, chatModel } = getDashscopeConfig();
  if (!apiKey) throw new Error('Missing env: DASHSCOPE_API_KEY');
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: chatModel,
      messages: [
        { role: 'system', content: '你是一位温暖、克制、不会编造事实的人生故事整理助手。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
    }),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${msg}`.trim());
  }
  const data = await resp.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

function createSupabaseAdminClient() {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const supabase = createSupabaseAdminClient();

function supabaseProfileToJson(row: any) {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    birthPlace: row.birth_place,
    gender: row.gender,
    occupation: row.occupation,
    cities: row.cities ?? [],
    avatar: row.avatar,
    bio: row.bio,
  };
}

function supabaseStoryToJson(row: any) {
  return {
    id: Number(row.id),
    profileId: row.profile_id,
    title: row.title,
    stage: row.stage,
    year: row.year,
    age: Number(row.age),
    emotion: row.emotion,
    tags: row.tags ?? [],
    content: row.content,
    timestamp: Number(row.timestamp),
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/profiles', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(supabaseProfileToJson));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/profiles/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(supabaseProfileToJson(data));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/api/profiles', async (req, res) => {
  try {
    const body = req.body ?? {};
    const id = String(body.id || '');
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const payload = {
      id,
      name: String(body.name || ''),
      birth_date: String(body.birthDate || ''),
      birth_place: String(body.birthPlace || ''),
      gender: String(body.gender || ''),
      occupation: String(body.occupation || ''),
      cities: Array.isArray(body.cities) ? body.cities : [],
      avatar: String(body.avatar || ''),
      bio: String(body.bio || ''),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('profiles').insert(payload).select('*').single();
    if (error) throw error;
    res.json(supabaseProfileToJson(data));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.put('/api/profiles/:id', async (req, res) => {
  try {
    const body = req.body ?? {};
    const payload = {
      name: String(body.name || ''),
      birth_date: String(body.birthDate || ''),
      birth_place: String(body.birthPlace || ''),
      gender: String(body.gender || ''),
      occupation: String(body.occupation || ''),
      cities: Array.isArray(body.cities) ? body.cities : [],
      avatar: String(body.avatar || ''),
      bio: String(body.bio || ''),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('profiles').update(payload).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    res.json(supabaseProfileToJson(data));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.delete('/api/profiles/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/profiles/:id/stories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('stories').select('*').eq('profile_id', req.params.id).order('timestamp', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(supabaseStoryToJson));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/api/profiles/:id/stories', async (req, res) => {
  try {
    const body = req.body ?? {};
    const now = Date.now();
    const title = String(body.title || '');
    const stage = String(body.stage || '');
    const year = String(body.year || '');
    const age = Number(body.age || 0);
    const emotion = String(body.emotion || 'neutral');
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
    const content = String(body.content || '');
    const timestamp = Number(body.timestamp || now);
    if (!title || !stage || !content) {
      res.status(400).json({ error: 'title, stage, content are required' });
      return;
    }
    const embedding = await dashscopeEmbedding(content);
    const payload: any = {
      profile_id: req.params.id,
      title,
      stage,
      year,
      age,
      emotion,
      tags,
      content,
      timestamp,
      updated_at: new Date(now).toISOString(),
    };
    if (embedding) payload.embedding = toVectorLiteral(embedding);
    let data: any = null;
    let error: any = null;
    ({ data, error } = await supabase.from('stories').insert(payload).select('*').single());
    if (error && typeof error.message === 'string' && error.message.includes('embedding')) {
      delete payload.embedding;
      ({ data, error } = await supabase.from('stories').insert(payload).select('*').single());
    }
    if (error) throw error;
    res.json(supabaseStoryToJson(data));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/stories/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('stories').select('*').eq('id', Number(req.params.id)).maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(supabaseStoryToJson(data));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.put('/api/stories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body ?? {};
    const now = Date.now();

    const { data: existing, error: e1 } = await supabase.from('stories').select('*').eq('id', id).maybeSingle();
    if (e1) throw e1;
    if (!existing) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const nextContent = String(body.content ?? existing.content);
    const contentChanged = nextContent !== String(existing.content);
    const embedding = contentChanged ? await dashscopeEmbedding(nextContent) : null;

    const next: any = {
      title: String(body.title ?? existing.title),
      stage: String(body.stage ?? existing.stage),
      year: String(body.year ?? existing.year),
      age: Number(body.age ?? existing.age),
      emotion: String(body.emotion ?? existing.emotion),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : (existing.tags ?? []),
      content: nextContent,
      timestamp: Number(body.timestamp ?? existing.timestamp),
      updated_at: new Date(now).toISOString(),
      embedding: embedding ? toVectorLiteral(embedding) : existing.embedding,
    };

    let data: any = null;
    let error: any = null;
    ({ data, error } = await supabase.from('stories').update(next).eq('id', id).select('*').single());
    if (error && typeof error.message === 'string' && error.message.includes('embedding')) {
      delete next.embedding;
      ({ data, error } = await supabase.from('stories').update(next).eq('id', id).select('*').single());
    }
    if (error) throw error;
    res.json(supabaseStoryToJson(data));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.delete('/api/stories/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('stories').delete().eq('id', Number(req.params.id));
    if (error) throw error;
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/api/rag/run', async (req, res) => {
  try {
    const userId = String(req.body?.userId || '');
    const userInput = String(req.body?.userInput || '');
    const topK = Number(req.body?.topK || 3);
    if (!userId || !userInput) {
      res.status(400).json({ error: 'userId and userInput are required' });
      return;
    }

    const inputEmbedding = await dashscopeEmbedding(userInput);
    if (!inputEmbedding) {
      res.status(500).json({ error: 'embedding is not configured' });
      return;
    }

    const { data: rows, error } = await supabase
      .from('stories')
      .select('id, year, tags, content, embedding, created_at')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const stories = (rows || []).map((r: any) => ({
      id: Number(r.id),
      year: r.year,
      tags: r.tags ?? [],
      content: String(r.content || ''),
      embedding: parseVector(r.embedding),
    }));

    const scored = stories
      .filter((s) => Array.isArray(s.embedding) && s.embedding.length === inputEmbedding.length)
      .map((s) => ({
        ...s,
        score: cosineSimilarity(inputEmbedding, s.embedding as number[]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK > 0 ? topK : 3);

    const prompt = buildRagPrompt(userInput, scored);
    const enhanced = await dashscopeChat(prompt);

    res.json({
      original: userInput,
      enhanced,
      meta: {
        totalStories: stories.length,
        embeddedStories: stories.filter((s) => Array.isArray(s.embedding) && s.embedding.length === inputEmbedding.length).length,
        embeddingDimensions: inputEmbedding.length,
      },
      relatedStories: scored.map((s) => ({
        id: s.id,
        year: s.year,
        tags: s.tags,
        content: s.content,
        score: s.score,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

export default function handler(req: any, res: any) {
  return app(req, res);
}


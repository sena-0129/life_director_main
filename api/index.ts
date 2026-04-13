import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          owner_key: string;
          name: string;
          birth_date: string;
          birth_place: string;
          gender: string;
          occupation: string;
          cities: Json;
          avatar: string;
          bio: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          owner_key: string;
          name?: string;
          birth_date?: string;
          birth_place?: string;
          gender?: string;
          occupation?: string;
          cities?: Json;
          avatar?: string;
          bio?: string;
          updated_at?: string;
        };
        Update: {
          owner_key?: string;
          name?: string;
          birth_date?: string;
          birth_place?: string;
          gender?: string;
          occupation?: string;
          cities?: Json;
          avatar?: string;
          bio?: string;
          updated_at?: string;
        };
      };
      stories: {
        Row: {
          id: number;
          profile_id: string;
          owner_key: string;
          year: string | null;
          tags: Json;
          content: string;
          embedding: unknown;
          created_at: string | null;
        };
        Insert: never;
        Update: never;
      };
    };
  };
};

function sendJson(res: any, status: number, body: any) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function redirect(res: any, location: string) {
  res.statusCode = 302;
  res.setHeader('location', location);
  res.end();
}

function readBodyJson(req: any, limitBytes = 25 * 1024 * 1024) {
  return new Promise<any>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing env: ${name}`);
  return v;
}

let _supabase: SupabaseClient<Database> | null = null;
function sb(): SupabaseClient<Database> {
  if (!_supabase) {
    const url = requireEnv('SUPABASE_URL');
    const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    _supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _supabase;
}

function getUserKey(req: any) {
  const v = req.headers['x-user-key'];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function getDashscopeConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const embeddingModel = process.env.DASHSCOPE_EMBEDDING_MODEL || 'text-embedding-v4';
  const embeddingDimensions = process.env.DASHSCOPE_EMBEDDING_DIMENSIONS ? Number(process.env.DASHSCOPE_EMBEDDING_DIMENSIONS) : 1024;
  const chatModel = process.env.DASHSCOPE_CHAT_MODEL || 'qwen3.5-plus';
  return { apiKey, baseUrl, embeddingModel, embeddingDimensions, chatModel };
}

function getArkConfig() {
  const apiKey = process.env.ARK_API_KEY;
  const baseUrl = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
  const scriptModel = process.env.ARK_SCRIPT_MODEL || 'doubao-seed-2-0-lite-260215';
  const videoModel = process.env.ARK_VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215';
  return { apiKey, baseUrl, scriptModel, videoModel };
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
    '任务：把用户刚刚的输入整理成一段更清晰、更有叙事性的第一人称回忆文字。在不改变事实的前提下，结合下面提供的“相关记忆”补全语境（仅限用户曾提到的内容）。',
    '要求：',
    '1) 必须全程使用第一人称（我/我们）叙述；禁止出现“你/您/用户”作为叙事主体。',
    '2) 不要凭空添加人物、地点、事件细节；不确定就保持模糊或用提问方式提示。',
    '3) 如果用户输入本身是第二人称表达，请将叙事主体改写为第一人称，不要改变事实。',
    '2) 输出用简洁中文，分段清晰（2-4段）。',
    '3) 如果相关记忆与当前输入有冲突，优先以当前输入为准，并用一句温和的话提示可能的差异。',
    '',
    `用户输入：\n${userInput}`,
    '',
    `相关记忆：\n${memories || '（无）'}`,
    '',
    '请输出：增强后的故事正文（第一人称）（不要输出分析过程）。',
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
        { role: 'system', content: '你是一位温暖、克制、不会编造事实的人生故事整理助手。你输出的故事必须全程使用第一人称（我/我们）叙述，禁止用“你/您”把读者当作当事人。' },
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

type ArkChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function arkChatCompletion(params: { model: string; messages: ArkChatMessage[]; temperature?: number }) {
  const ark = getArkConfig();
  if (!ark.apiKey) throw new Error('Missing env: ARK_API_KEY');
  const resp = await fetch(`${ark.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ark.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.4,
    }),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${msg}`.trim());
  }
  const data: any = await resp.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function arkCreateVideoTask(params: { model: string; prompt: string }) {
  const ark = getArkConfig();
  if (!ark.apiKey) throw new Error('Missing env: ARK_API_KEY');
  const resp = await fetch(`${ark.baseUrl}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ark.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      content: [{ type: 'text', text: params.prompt }],
    }),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${msg}`.trim());
  }
  return (await resp.json()) as any;
}

async function arkGetVideoTask(taskId: string) {
  const ark = getArkConfig();
  if (!ark.apiKey) throw new Error('Missing env: ARK_API_KEY');
  const resp = await fetch(`${ark.baseUrl}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${ark.apiKey}`,
    },
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${msg}`.trim());
  }
  return (await resp.json()) as any;
}

function findFirstUrl(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') return obj.startsWith('http') ? obj : null;
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = findFirstUrl(it);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const r = findFirstUrl(obj[k]);
      if (r) return r;
    }
  }
  return null;
}

function arkExtractVideoUrl(taskResult: any) {
  return findFirstUrl(taskResult);
}

async function supabaseSignedUrl(bucket: string, objectPath: string) {
  const { data, error } = await (sb().storage as any).from(bucket).createSignedUrl(objectPath, 60 * 10);
  if (error) throw error;
  return String(data.signedUrl);
}

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

export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const path = url.pathname;
    const method = String(req.method || 'GET').toUpperCase();

    const backendToken = process.env.BACKEND_TOKEN;
    if (backendToken && path !== '/api/health') {
      const auth = String(req.headers.authorization || '');
      const expected = `Bearer ${backendToken}`;
      if (auth !== expected) {
        sendJson(res, 401, { error: 'unauthorized' });
        return;
      }
    }

    if (method === 'GET' && path === '/api/health') {
      sendJson(res, 200, { ok: true, git: process.env.VERCEL_GIT_COMMIT_SHA || null });
      return;
    }

    const userKey = getUserKey(req);
    if (!userKey) {
      sendJson(res, 400, { error: 'missing x-user-key' });
      return;
    }

    if (method === 'GET' && path === '/api/profiles') {
      const { data, error } = await sb().from('profiles').select('*').eq('owner_key', userKey).order('updated_at', { ascending: false });
      if (error) throw error;
      sendJson(res, 200, (data || []).map(supabaseProfileToJson));
      return;
    }

    const mProfile = path.match(/^\/api\/profiles\/([^/]+)$/);
    if (mProfile && method === 'GET') {
      const id = decodeURIComponent(mProfile[1]);
      const { data, error } = await sb().from('profiles').select('*').eq('id', id).eq('owner_key', userKey).maybeSingle();
      if (error) throw error;
      if (!data) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      sendJson(res, 200, supabaseProfileToJson(data));
      return;
    }
    if (mProfile && method === 'PUT') {
      const id = decodeURIComponent(mProfile[1]);
      const body = await readBodyJson(req);
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
      const { data, error } = await (sb().from('profiles') as any).update(payload).eq('id', id).eq('owner_key', userKey).select('*').single();
      if (error) throw error;
      sendJson(res, 200, supabaseProfileToJson(data));
      return;
    }
    if (mProfile && method === 'DELETE') {
      const id = decodeURIComponent(mProfile[1]);
      const { error } = await sb().from('profiles').delete().eq('id', id).eq('owner_key', userKey);
      if (error) throw error;
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'POST' && path === '/api/profiles') {
      const body = await readBodyJson(req);
      const id = String(body.id || '');
      if (!id) {
        sendJson(res, 400, { error: 'id is required' });
        return;
      }
      const payload = {
        id,
        owner_key: userKey,
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
      const { data, error } = await (sb().from('profiles') as any).insert(payload).select('*').single();
      if (error) throw error;
      sendJson(res, 200, supabaseProfileToJson(data));
      return;
    }

    const mProfileStories = path.match(/^\/api\/profiles\/([^/]+)\/stories$/);
    if (mProfileStories && method === 'GET') {
      const profileId = decodeURIComponent(mProfileStories[1]);
      const { data: profile, error: e1 } = await sb().from('profiles').select('id').eq('id', profileId).eq('owner_key', userKey).maybeSingle();
      if (e1) throw e1;
      if (!profile) {
        sendJson(res, 404, { error: 'profile not found' });
        return;
      }
      const { data, error } = await (sb().from('stories') as any)
        .select('*')
        .eq('profile_id', profileId)
        .eq('owner_key', userKey)
        .order('timestamp', { ascending: false });
      if (error) throw error;
      sendJson(res, 200, (data || []).map(supabaseStoryToJson));
      return;
    }
    if (mProfileStories && method === 'POST') {
      const profileId = decodeURIComponent(mProfileStories[1]);
      const { data: profile, error: e1 } = await sb().from('profiles').select('id').eq('id', profileId).eq('owner_key', userKey).maybeSingle();
      if (e1) throw e1;
      if (!profile) {
        sendJson(res, 404, { error: 'profile not found' });
        return;
      }

      const body = await readBodyJson(req);
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
        sendJson(res, 400, { error: 'title, stage, content are required' });
        return;
      }

      const embedding = await dashscopeEmbedding(content);
      const payload: any = {
        profile_id: profileId,
        owner_key: userKey,
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
      ({ data, error } = await (sb().from('stories') as any).insert(payload).select('*').single());
      if (error && typeof error.message === 'string' && error.message.includes('embedding')) {
        delete payload.embedding;
        ({ data, error } = await (sb().from('stories') as any).insert(payload).select('*').single());
      }
      if (error) throw error;
      sendJson(res, 200, supabaseStoryToJson(data));
      return;
    }

    const mStory = path.match(/^\/api\/stories\/([^/]+)$/);
    if (mStory && method === 'GET') {
      const id = Number(decodeURIComponent(mStory[1]));
      const { data, error } = await (sb().from('stories') as any).select('*').eq('id', id).eq('owner_key', userKey).maybeSingle();
      if (error) throw error;
      if (!data) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      sendJson(res, 200, supabaseStoryToJson(data));
      return;
    }
    if (mStory && method === 'PUT') {
      const id = Number(decodeURIComponent(mStory[1]));
      const body = await readBodyJson(req);
      const now = Date.now();

      const { data: existing, error: e1 } = await (sb().from('stories') as any).select('*').eq('id', id).eq('owner_key', userKey).maybeSingle();
      if (e1) throw e1;
      if (!existing) {
        sendJson(res, 404, { error: 'not found' });
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
      ({ data, error } = await (sb().from('stories') as any).update(next).eq('id', id).select('*').single());
      if (error && typeof error.message === 'string' && error.message.includes('embedding')) {
        delete next.embedding;
        ({ data, error } = await (sb().from('stories') as any).update(next).eq('id', id).select('*').single());
      }
      if (error) throw error;
      sendJson(res, 200, supabaseStoryToJson(data));
      return;
    }
    if (mStory && method === 'DELETE') {
      const id = Number(decodeURIComponent(mStory[1]));
      const { error } = await (sb().from('stories') as any).delete().eq('id', id).eq('owner_key', userKey);
      if (error) throw error;
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'POST' && path === '/api/rag/run') {
      const body = await readBodyJson(req);
      const userId = String(body.userId || '');
      const userInput = String(body.userInput || '');
      const topK = Number(body.topK || 3);
      if (!userId || !userInput) {
        sendJson(res, 400, { error: 'userId and userInput are required' });
        return;
      }

      const inputEmbedding = await dashscopeEmbedding(userInput);
      if (!inputEmbedding) {
        sendJson(res, 500, { error: 'embedding is not configured' });
        return;
      }

      const { data: profile, error: e1 } = await sb().from('profiles').select('id').eq('id', userId).eq('owner_key', userKey).maybeSingle();
      if (e1) throw e1;
      if (!profile) {
        sendJson(res, 404, { error: 'profile not found' });
        return;
      }

      const { data: rows, error } = await (sb().from('stories') as any)
        .select('id, year, tags, content, embedding, created_at')
        .eq('profile_id', userId)
        .eq('owner_key', userKey)
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
        .filter((s: any) => Array.isArray(s.embedding) && s.embedding.length === inputEmbedding.length)
        .map((s: any) => ({
          ...s,
          score: cosineSimilarity(inputEmbedding, s.embedding as number[]),
        }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, topK > 0 ? topK : 3);

      const prompt = buildRagPrompt(userInput, scored);
      const enhanced = await dashscopeChat(prompt);

      sendJson(res, 200, {
        original: userInput,
        enhanced,
        meta: {
          totalStories: stories.length,
          embeddedStories: stories.filter((s: any) => Array.isArray(s.embedding) && s.embedding.length === inputEmbedding.length).length,
          embeddingDimensions: inputEmbedding.length,
        },
        relatedStories: scored.map((s: any) => ({
          id: s.id,
          year: s.year,
          tags: s.tags,
          content: s.content,
          score: s.score,
        })),
      });
      return;
    }

    if (method === 'GET' && path === '/api/ai/videos') {
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 30)));
      const { data, error } = await (sb().from('ai_videos') as any)
        .select('id, status, created_at, bucket, object_path')
        .eq('owner_key', userKey)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      sendJson(res, 200, {
        items: (data || []).map((r: any) => ({
          id: String(r.id),
          status: String(r.status || ''),
          createdAt: String(r.created_at || ''),
          hasFile: Boolean(r.object_path && String(r.object_path).length > 0),
          videoUrl: `/api/ai/video/${String(r.id)}`,
        })),
      });
      return;
    }

    if (method === 'POST' && path === '/api/ai/video') {
      const body = await readBodyJson(req);
      const prompt = String(body.prompt || '');
      const aspectRatio = String(body.aspectRatio || '16:9');
      if (!prompt) {
        sendJson(res, 400, { error: 'prompt is required' });
        return;
      }

      const ark = getArkConfig();
      if (!ark.apiKey) throw new Error('Missing env: ARK_API_KEY');

      const scriptPrompt = [
        '你是一位纪录片编导。请把“用户故事素材”改写成一段用于文生视频的中文提示词。',
        '要求：',
        '1) 怀旧纪实风格，温情但克制。',
        '2) 只输出提示词正文，不要输出标题、解释、JSON。',
        '3) 重点写画面、人物动作、镜头语言、光线、年代氛围；避免抽象说教。',
        '4) 不要出现“你/您”。',
        '',
        `用户故事素材：\n${prompt}`,
      ].join('\n');

      const script = await arkChatCompletion({
        model: ark.scriptModel,
        messages: [
          { role: 'system', content: '你是专业的视频提示词编导。' },
          { role: 'user', content: scriptPrompt },
        ],
        temperature: 0.4,
      });

      const t2vPrompt = `${script} --resolution 720p --duration 8 --ratio ${aspectRatio}`;
      const task = await arkCreateVideoTask({ model: ark.videoModel, prompt: t2vPrompt });
      const taskId = String(task?.id || '');
      if (!taskId) throw new Error('ark task id missing');

      const id = randomUUID();
      const { error } = await (sb().from('ai_videos') as any).insert({
        id,
        owner_key: userKey,
        bucket: 'videos',
        object_path: '',
        ark_task_id: taskId,
        status: String(task?.status || ''),
        prompt: t2vPrompt,
        script,
      });
      if (error) throw error;

      sendJson(res, 200, { videoUrl: `/api/ai/video/${id}` });
      return;
    }

    const mAiVideo = path.match(/^\/api\/ai\/video\/([^/]+)$/);
    if (mAiVideo && method === 'GET') {
      const id = decodeURIComponent(mAiVideo[1]);
      const { data, error } = await (sb().from('ai_videos') as any).select('*').eq('id', id).eq('owner_key', userKey).maybeSingle();
      if (error) throw error;
      if (!data) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }

      if (data.object_path && String(data.object_path).length > 0) {
        const signedUrl = await supabaseSignedUrl(String(data.bucket), String(data.object_path));
        redirect(res, signedUrl);
        return;
      }

      const ark = getArkConfig();
      if (!ark.apiKey) throw new Error('Missing env: ARK_API_KEY');

      const taskId = String(data.ark_task_id || '');
      if (!taskId) {
        sendJson(res, 500, { error: 'missing task id' });
        return;
      }

      const task = await arkGetVideoTask(taskId);
      const status = String(task?.status || '');
      if (status && status !== String(data.status || '')) {
        await (sb().from('ai_videos') as any).update({ status }).eq('id', id);
      }

      if (status === 'failed') {
        sendJson(res, 500, { error: 'video generation failed' });
        return;
      }
      if (status !== 'succeeded') {
        sendJson(res, 202, { status });
        return;
      }

      const videoSourceUrl = arkExtractVideoUrl(task);
      if (!videoSourceUrl) {
        sendJson(res, 500, { error: 'video url missing' });
        return;
      }

      const dl = await fetch(videoSourceUrl);
      if (!dl.ok) throw new Error(`video download failed: ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());

      const bucket = 'videos';
      const objectPath = `${id}.mp4`;
      const { error: uploadError } = await (sb().storage as any).from(bucket).upload(objectPath, buf, {
        contentType: 'video/mp4',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      await (sb().from('ai_videos') as any).update({ bucket, object_path: objectPath }).eq('id', id);
      const signedUrl = await supabaseSignedUrl(bucket, objectPath);
      redirect(res, signedUrl);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (e: any) {
    sendJson(res, 500, {
      error: 'INTERNAL_ERROR',
      message: e?.message || String(e),
      name: e?.name,
      stack: typeof e?.stack === 'string' ? e.stack.split('\n').slice(0, 10).join('\n') : undefined,
      git: process.env.VERCEL_GIT_COMMIT_SHA || null,
    });
  }
}

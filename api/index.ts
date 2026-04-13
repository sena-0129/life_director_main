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
    };
  };
};

function sendJson(res: any, status: number, body: any) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
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

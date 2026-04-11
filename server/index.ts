import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { loadEnv } from './env';
import { openDb, rowToProfile, rowToStory } from './db';
import { aiChat, aiTts, aiVideoToDisk } from './ai';
import { arkChatCompletion, arkCreateVideoTask, arkExtractVideoUrl, arkGetVideoTask } from './ark';
import { ensureDir, insertUpload, sanitizeFileName, sha256Buffer, sha256File, uploadRowToJson } from './uploads';
import { createSupabaseAdminClient } from './supabase';

loadEnv();

const port = Number(process.env.PORT || 3001);
const dbPath = process.env.DATABASE_PATH || './data/life-director.sqlite';
const videosDir = process.env.VIDEOS_DIR || './data/videos';
const uploadsDir = process.env.UPLOADS_DIR || './data/uploads';
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 20);
const useSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = useSupabase ? createSupabaseAdminClient() : null;
const db = useSupabase ? null : openDb(dbPath);

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

const app = express();
app.use(express.json({ limit: '25mb' }));

const upload = multer({
  storage: useSupabase
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: async (_req, _file, cb) => {
          try {
            await ensureDir(uploadsDir);
            cb(null, uploadsDir);
          } catch (e: any) {
            cb(e, uploadsDir);
          }
        },
        filename: (_req, file, cb) => {
          const id = randomUUID();
          const safe = sanitizeFileName(file.originalname);
          cb(null, `${id}__${safe}`);
        },
      }),
  limits: {
    fileSize: maxUploadMb * 1024 * 1024,
  },
});

function sb() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
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

function supabaseUploadToJson(row: any) {
  return {
    id: row.id,
    profileId: row.profile_id ?? undefined,
    originalName: row.original_name,
    storedName: row.object_path,
    mimeType: row.mime_type,
    size: Number(row.size),
    sha256: row.sha256,
    bucket: row.bucket,
    createdAt: row.created_at,
  };
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
    '任务：把用户刚刚的输入整理成一段更清晰、更有叙事性的第一人称回忆文字，在输出中包含人物、地点、事件等细节。并在不改变事实的前提下，结合下面提供的“相关记忆”补全语境（仅限用户曾提到的内容）。',
    '要求：',
    '1) 不要凭空添加人物、地点、事件细节；不确定就保持模糊或用提问方式提示。',
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

function getUserKey(req: any) {
  const v = req.headers['x-user-key'];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

app.get('/api/profiles', async (req, res) => {
  try {
    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const { data, error } = await sb().from('profiles').select('*').eq('owner_key', userKey).order('updated_at', { ascending: false });
      if (error) throw error;
      res.json((data || []).map(supabaseProfileToJson));
      return;
    }

    const rows = db!.prepare('select * from profiles order by updated_at desc').all();
    res.json(rows.map(rowToProfile));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/api/profiles', async (req, res) => {
  try {
    const body = req.body ?? {};
    const now = Date.now();
    const id = String(body.id || '');
    const name = String(body.name || '');
    const birthDate = String(body.birthDate || '');
    const birthPlace = String(body.birthPlace || '');
    const gender = String(body.gender || '');
    const occupation = String(body.occupation || '');
    const cities = Array.isArray(body.cities) ? body.cities.map(String) : [];
    const avatar = String(body.avatar || '');
    const bio = String(body.bio || '');

    if (!id || !name) {
      res.status(400).json({ error: 'id and name are required' });
      return;
    }

    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const { data, error } = await sb()
        .from('profiles')
        .insert({
          id,
          owner_key: userKey,
          name,
          birth_date: birthDate,
          birth_place: birthPlace,
          gender,
          occupation,
          cities,
          avatar,
          bio,
          updated_at: new Date(now).toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      res.json(supabaseProfileToJson(data));
      return;
    }

    db!.prepare(
      'insert into profiles (id, name, birth_date, birth_place, gender, occupation, cities_json, avatar, bio, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, name, birthDate, birthPlace, gender, occupation, JSON.stringify(cities), avatar, bio, now, now);

    const row = db!.prepare('select * from profiles where id = ?').get(id);
    res.json(rowToProfile(row));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/profiles/:id', async (req, res) => {
  try {
    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const { data, error } = await sb().from('profiles').select('*').eq('id', req.params.id).eq('owner_key', userKey).maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.json(supabaseProfileToJson(data));
      return;
    }

    const row = db!.prepare('select * from profiles where id = ?').get(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(rowToProfile(row));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.put('/api/profiles/:id', async (req, res) => {
  try {
    const body = req.body ?? {};
    const now = Date.now();

    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const { data: existing, error: e1 } = await sb().from('profiles').select('*').eq('id', req.params.id).eq('owner_key', userKey).maybeSingle();
      if (e1) throw e1;
      if (!existing) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      const next = {
        name: String(body.name ?? existing.name),
        birth_date: String(body.birthDate ?? existing.birth_date),
        birth_place: String(body.birthPlace ?? existing.birth_place),
        gender: String(body.gender ?? existing.gender),
        occupation: String(body.occupation ?? existing.occupation),
        cities: Array.isArray(body.cities) ? body.cities.map(String) : (existing.cities ?? []),
        avatar: String(body.avatar ?? existing.avatar),
        bio: String(body.bio ?? existing.bio),
        updated_at: new Date(now).toISOString(),
      };
      const { data, error } = await sb().from('profiles').update(next).eq('id', req.params.id).select('*').single();
      if (error) throw error;
      res.json(supabaseProfileToJson(data));
      return;
    }

    const existing = db!.prepare('select * from profiles where id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const next = {
      id: req.params.id,
      name: String(body.name ?? existing.name),
      birth_date: String(body.birthDate ?? existing.birth_date),
      birth_place: String(body.birthPlace ?? existing.birth_place),
      gender: String(body.gender ?? existing.gender),
      occupation: String(body.occupation ?? existing.occupation),
      cities_json: JSON.stringify(Array.isArray(body.cities) ? body.cities.map(String) : JSON.parse(existing.cities_json ?? '[]')),
      avatar: String(body.avatar ?? existing.avatar),
      bio: String(body.bio ?? existing.bio),
    };

    db!.prepare(
      'update profiles set name = ?, birth_date = ?, birth_place = ?, gender = ?, occupation = ?, cities_json = ?, avatar = ?, bio = ?, updated_at = ? where id = ?',
    ).run(next.name, next.birth_date, next.birth_place, next.gender, next.occupation, next.cities_json, next.avatar, next.bio, now, next.id);

    const row = db!.prepare('select * from profiles where id = ?').get(req.params.id);
    res.json(rowToProfile(row));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.delete('/api/profiles/:id', async (req, res) => {
  try {
    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const { error } = await sb().from('profiles').delete().eq('id', req.params.id).eq('owner_key', userKey);
      if (error) throw error;
      res.json({ ok: true });
      return;
    }

    db!.prepare('delete from profiles where id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/profiles/:id/stories', async (req, res) => {
  try {
    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const { data: profile, error: e1 } = await sb().from('profiles').select('id').eq('id', req.params.id).eq('owner_key', userKey).maybeSingle();
      if (e1) throw e1;
      if (!profile) {
        res.status(404).json({ error: 'profile not found' });
        return;
      }
      const { data, error } = await sb().from('stories').select('*').eq('profile_id', req.params.id).eq('owner_key', userKey).order('timestamp', { ascending: false });
      if (error) throw error;
      res.json((data || []).map(supabaseStoryToJson));
      return;
    }

    const rows = db!.prepare('select * from stories where profile_id = ? order by timestamp desc').all(req.params.id);
    res.json(rows.map(rowToStory));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/api/profiles/:id/stories', async (req, res) => {
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

  try {
    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const { data: profile, error: e1 } = await sb().from('profiles').select('id').eq('id', req.params.id).eq('owner_key', userKey).maybeSingle();
      if (e1) throw e1;
      if (!profile) {
        res.status(404).json({ error: 'profile not found' });
        return;
      }

      const embedding = await dashscopeEmbedding(content);
      const payload: any = {
        profile_id: req.params.id,
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
      ({ data, error } = await sb().from('stories').insert(payload).select('*').single());
      if (error && typeof error.message === 'string' && error.message.includes('embedding')) {
        delete payload.embedding;
        ({ data, error } = await sb().from('stories').insert(payload).select('*').single());
      }
      if (error) throw error;
      res.json(supabaseStoryToJson(data));
      return;
    }

    const profile = db!.prepare('select id from profiles where id = ?').get(req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }

    const info = db!
      .prepare(
        'insert into stories (profile_id, title, stage, year, age, emotion, tags_json, content, timestamp, cover_image, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(req.params.id, title, stage, year, age, emotion, JSON.stringify(tags), content, timestamp, null, now, now);

    const row = db!.prepare('select * from stories where id = ?').get(info.lastInsertRowid);
    res.json(rowToStory(row));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/stories/:id', async (req, res) => {
  try {
    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const id = Number(req.params.id);
      const { data, error } = await sb().from('stories').select('*').eq('id', id).eq('owner_key', userKey).maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.json(supabaseStoryToJson(data));
      return;
    }

    const row = db!.prepare('select * from stories where id = ?').get(Number(req.params.id));
    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(rowToStory(row));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.put('/api/stories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body ?? {};
    const now = Date.now();

    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const { data: existing, error: e1 } = await sb().from('stories').select('*').eq('id', id).eq('owner_key', userKey).maybeSingle();
      if (e1) throw e1;
      if (!existing) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      const nextContent = String(body.content ?? existing.content);
      const contentChanged = nextContent !== String(existing.content);
      const embedding = contentChanged ? await dashscopeEmbedding(nextContent) : null;

      const next = {
        title: String(body.title ?? existing.title),
        stage: String(body.stage ?? existing.stage),
        year: String(body.year ?? existing.year),
        age: Number(body.age ?? existing.age),
        emotion: String(body.emotion ?? existing.emotion),
        tags: Array.isArray(body.tags) ? body.tags.map(String) : (existing.tags ?? []),
        content: nextContent,
        timestamp: Number(body.timestamp ?? existing.timestamp),
        cover_image: existing.cover_image,
        updated_at: new Date(now).toISOString(),
        embedding: embedding ? toVectorLiteral(embedding) : existing.embedding,
      } as any;

      let data: any = null;
      let error: any = null;
      ({ data, error } = await sb().from('stories').update(next).eq('id', id).select('*').single());
      if (error && typeof error.message === 'string' && error.message.includes('embedding')) {
        delete (next as any).embedding;
        ({ data, error } = await sb().from('stories').update(next).eq('id', id).select('*').single());
      }
      if (error) throw error;
      res.json(supabaseStoryToJson(data));
      return;
    }

    const existing = db!.prepare('select * from stories where id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const next = {
      title: String(body.title ?? existing.title),
      stage: String(body.stage ?? existing.stage),
      year: String(body.year ?? existing.year),
      age: Number(body.age ?? existing.age),
      emotion: String(body.emotion ?? existing.emotion),
      tags_json: JSON.stringify(Array.isArray(body.tags) ? body.tags.map(String) : JSON.parse(existing.tags_json ?? '[]')),
      content: String(body.content ?? existing.content),
      timestamp: Number(body.timestamp ?? existing.timestamp),
      cover_image: existing.cover_image,
    };

    db!.prepare(
      'update stories set title = ?, stage = ?, year = ?, age = ?, emotion = ?, tags_json = ?, content = ?, timestamp = ?, cover_image = ?, updated_at = ? where id = ?',
    ).run(next.title, next.stage, next.year, next.age, next.emotion, next.tags_json, next.content, next.timestamp, next.cover_image, now, id);

    const row = db!.prepare('select * from stories where id = ?').get(id);
    res.json(rowToStory(row));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.delete('/api/stories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (useSupabase) {
      const userKey = getUserKey(req);
      if (!userKey) {
        res.status(400).json({ error: 'missing x-user-key' });
        return;
      }
      const { error } = await sb().from('stories').delete().eq('id', id).eq('owner_key', userKey);
      if (error) throw error;
      res.json({ ok: true });
      return;
    }

    db!.prepare('delete from stories where id = ?').run(id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/api/rag/run', async (req, res) => {
  try {
    if (!useSupabase) {
      res.status(400).json({ error: 'rag requires supabase' });
      return;
    }

    const userKey = getUserKey(req);
    if (!userKey) {
      res.status(400).json({ error: 'missing x-user-key' });
      return;
    }

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

    const { data: profile, error: e1 } = await sb().from('profiles').select('id').eq('id', userId).eq('owner_key', userKey).maybeSingle();
    if (e1) throw e1;
    if (!profile) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }

    const { data: rows, error } = await sb()
      .from('stories')
      .select('id, year, tags, content, embedding')
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

app.post('/api/ai/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '');
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    const text = await aiChat(message);
    res.json({ text });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/api/ai/tts', async (req, res) => {
  try {
    const text = String(req.body?.text || '');
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    const audioDataUrl = await aiTts(text);
    res.json({ audioDataUrl });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/api/ai/video', async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '');
    const aspectRatio = (req.body?.aspectRatio || '16:9') as '16:9' | '9:16';
    const imageDataUrl = req.body?.imageDataUrl ? String(req.body.imageDataUrl) : undefined;
    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    if (useSupabase) {
      const scriptModel = process.env.ARK_SCRIPT_MODEL || 'doubao-seed-2-0-lite-260215';
      const videoModel = process.env.ARK_VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215';

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
        model: scriptModel,
        messages: [
          { role: 'system', content: '你是专业的视频提示词编导。' },
          { role: 'user', content: scriptPrompt },
        ],
        temperature: 0.4,
      });

      const t2vPrompt = `${script} --resolution 720p --duration 8 --ratio ${aspectRatio}`;
      const task = await arkCreateVideoTask({ model: videoModel, prompt: t2vPrompt });
      const taskId = String(task?.id || '');
      if (!taskId) throw new Error('ark task id missing');

      const id = randomUUID();
      const { error: insertError } = await sb().from('ai_videos').insert({
        id,
        bucket: 'videos',
        object_path: '',
        ark_task_id: taskId,
        status: String(task?.status || ''),
        prompt: t2vPrompt,
        script,
      });
      if (insertError) throw insertError;

      res.json({ videoUrl: `/api/ai/video/${id}` });
      return;
    }

    const result = await aiVideoToDisk({ prompt, imageDataUrl, aspectRatio, db: db!, videosDir });
    if (!result) {
      res.json({ videoUrl: null });
      return;
    }
    res.json({ videoUrl: `/api/ai/video/${result.id}` });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/ai/video/:id', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await sb().from('ai_videos').select('*').eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      if (data.object_path && String(data.object_path).length > 0) {
        const { data: signed, error: signError } = await sb().storage.from(String(data.bucket)).createSignedUrl(String(data.object_path), 60 * 10);
        if (signError) throw signError;
        res.redirect(signed.signedUrl);
        return;
      }

      const taskId = String(data.ark_task_id || '');
      if (!taskId) {
        res.status(500).json({ error: 'missing task id' });
        return;
      }

      const task = await arkGetVideoTask(taskId);
      const status = String(task?.status || '');
      if (status !== String(data.status || '')) {
        await sb().from('ai_videos').update({ status }).eq('id', req.params.id);
      }

      if (status === 'failed') {
        res.status(500).json({ error: 'video generation failed' });
        return;
      }
      if (status !== 'succeeded') {
        res.status(202).json({ status });
        return;
      }

      const videoSourceUrl = arkExtractVideoUrl(task);
      if (!videoSourceUrl) {
        res.status(500).json({ error: 'video url missing' });
        return;
      }

      const dl = await fetch(videoSourceUrl);
      if (!dl.ok) throw new Error(`video download failed: ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());

      const bucket = 'videos';
      const objectPath = `${req.params.id}.mp4`;
      const { error: uploadError } = await sb().storage.from(bucket).upload(objectPath, buf, {
        contentType: 'video/mp4',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      await sb().from('ai_videos').update({ bucket, object_path: objectPath }).eq('id', req.params.id);

      const { data: signed, error: signError } = await sb().storage.from(bucket).createSignedUrl(objectPath, 60 * 10);
      if (signError) throw signError;
      res.redirect(signed.signedUrl);
      return;
    }

    const row = db!.prepare('select * from ai_videos where id = ?').get(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const filePath = String(row.file_path);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'file missing' });
      return;
    }
    res.setHeader('content-type', 'video/mp4');
    res.sendFile(path.resolve(filePath));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/api/uploads', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'file is required (field name: file)' });
      return;
    }

    const originalName = String(file.originalname || '');
    const mimeType = String(file.mimetype || '');
    const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff)$/i.test(originalName);
    if (isImage) {
      if (!useSupabase && (file as any).path) {
        try {
          await fs.promises.unlink(String((file as any).path));
        } catch {
        }
      }
      res.status(400).json({ error: 'image uploads are disabled' });
      return;
    }

    const profileId = req.body?.profileId ? String(req.body.profileId) : undefined;

    if (useSupabase) {
      if (profileId) {
        const { data: profile, error: e1 } = await sb().from('profiles').select('id').eq('id', profileId).maybeSingle();
        if (e1) throw e1;
        if (!profile) {
          res.status(400).json({ error: 'profileId not found' });
          return;
        }
      }

      const id = randomUUID();
      const safe = sanitizeFileName(originalName);
      const bucket = 'uploads';
      const objectPath = `${id}__${safe}`;
      const buf = Buffer.isBuffer((file as any).buffer) ? (file as any).buffer : Buffer.from((file as any).buffer);
      const sha256 = sha256Buffer(buf);

      const { error: uploadError } = await sb().storage.from(bucket).upload(objectPath, buf, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data, error } = await sb()
        .from('uploads')
        .insert({
          id,
          profile_id: profileId ?? null,
          original_name: originalName,
          mime_type: mimeType || 'application/octet-stream',
          size: file.size,
          sha256,
          bucket,
          object_path: objectPath,
        })
        .select('*')
        .single();
      if (error) throw error;
      res.json(supabaseUploadToJson(data));
      return;
    }

    if (profileId) {
      const profile = db!.prepare('select id from profiles where id = ?').get(profileId);
      if (!profile) {
        res.status(400).json({ error: 'profileId not found' });
        return;
      }
    }

    const storedName = path.basename((file as any).filename);
    const filePath = path.join(uploadsDir, storedName);
    const sha256 = await sha256File(filePath);
    const id = storedName.split('__')[0];

    insertUpload(db!, {
      id,
      profileId,
      originalName,
      storedName,
      mimeType,
      size: file.size,
      sha256,
      storagePath: filePath,
    });

    const row = db!.prepare('select * from uploads where id = ?').get(id);
    res.json(uploadRowToJson(row));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/uploads', async (req, res) => {
  try {
    const profileId = req.query.profileId ? String(req.query.profileId) : undefined;
    if (useSupabase) {
      const query = sb().from('uploads').select('*').order('created_at', { ascending: false });
      const { data, error } = profileId ? await query.eq('profile_id', profileId) : await query;
      if (error) throw error;
      res.json((data || []).map(supabaseUploadToJson));
      return;
    }

    const rows = profileId
      ? db!.prepare('select * from uploads where profile_id = ? order by created_at desc').all(profileId)
      : db!.prepare('select * from uploads order by created_at desc').all();
    res.json(rows.map(uploadRowToJson));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/uploads/:id', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await sb().from('uploads').select('*').eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.json(supabaseUploadToJson(data));
      return;
    }

    const row = db!.prepare('select * from uploads where id = ?').get(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(uploadRowToJson(row));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.get('/api/uploads/:id/file', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await sb().from('uploads').select('*').eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      const { data: signed, error: signError } = await sb().storage.from(String(data.bucket)).createSignedUrl(String(data.object_path), 60 * 10);
      if (signError) throw signError;
      res.redirect(signed.signedUrl);
      return;
    }

    const row = db!.prepare('select * from uploads where id = ?').get(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const filePath = String(row.storage_path);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'file missing' });
      return;
    }
    res.setHeader('content-type', String(row.mime_type || 'application/octet-stream'));
    res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(String(row.original_name))}`);
    res.sendFile(path.resolve(filePath));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.delete('/api/uploads/:id', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await sb().from('uploads').select('*').eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      await sb().storage.from(String(data.bucket)).remove([String(data.object_path)]);
      const { error: delError } = await sb().from('uploads').delete().eq('id', req.params.id);
      if (delError) throw delError;
      res.json({ ok: true });
      return;
    }

    const row = db!.prepare('select * from uploads where id = ?').get(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const filePath = String(row.storage_path);
    db!.prepare('delete from uploads where id = ?').run(req.params.id);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.listen(port, () => {
  process.stdout.write(`backend listening on http://localhost:${port}\n`);
});

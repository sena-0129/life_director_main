type ArkChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing env: ${name}`);
  return v;
}

function getEnv(name: string, fallback?: string) {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : fallback;
}

function arkBaseUrl() {
  return getEnv('ARK_BASE_URL', 'https://ark.cn-beijing.volces.com/api/v3');
}

function arkHeaders() {
  const apiKey = requireEnv('ARK_API_KEY');
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  } as const;
}

function findFirstUrl(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') {
    if (obj.startsWith('http')) return obj;
    return null;
  }
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

export async function arkChatCompletion(params: { model: string; messages: ArkChatMessage[]; temperature?: number }) {
  const resp = await fetch(`${arkBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: arkHeaders(),
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

export async function arkCreateVideoTask(params: { model: string; prompt: string }) {
  const resp = await fetch(`${arkBaseUrl()}/contents/generations/tasks`, {
    method: 'POST',
    headers: arkHeaders(),
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

export async function arkGetVideoTask(taskId: string) {
  const resp = await fetch(`${arkBaseUrl()}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: arkHeaders(),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${msg}`.trim());
  }
  return (await resp.json()) as any;
}

export function arkExtractVideoUrl(taskResult: any) {
  const url = findFirstUrl(taskResult);
  return url;
}


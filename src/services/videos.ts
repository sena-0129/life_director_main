import { getOrCreateUserKey } from '../utils/userKey';

export type MyVideoItem = {
  id: string;
  status: string;
  createdAt: string;
  hasFile: boolean;
  videoUrl: string;
};

const apiBaseUrl = import.meta.env.DEV ? (import.meta.env.VITE_API_BASE_URL || '') : '';

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

function backendHeaders() {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = import.meta.env.VITE_BACKEND_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  headers['x-user-key'] = getOrCreateUserKey();
  return headers;
}

export async function listMyVideos(limit = 30) {
  const res = await fetch(apiUrl(`/api/ai/videos?limit=${encodeURIComponent(String(limit))}`), {
    headers: backendHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `List videos failed: ${res.status}`);
  }
  return (await res.json()) as { items: MyVideoItem[] };
}

export async function downloadVideoObjectUrl(id: string) {
  const startedAt = Date.now();
  while (true) {
    const res = await fetch(apiUrl(`/api/ai/video/${encodeURIComponent(id)}`), {
      headers: backendHeaders(),
      redirect: 'follow',
    });
    if (res.status === 202) {
      if (Date.now() - startedAt > 25 * 60 * 1000) throw new Error('Video generation timeout');
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Video download failed: ${res.status}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
}


export type RagRelatedStory = {
  id: number;
  year?: string;
  tags?: string[];
  content: string;
  score: number;
};

export type RagRunResponse = {
  original: string;
  enhanced: string;
  relatedStories: RagRelatedStory[];
  meta?: {
    totalStories: number;
    embeddedStories: number;
    embeddingDimensions: number | null;
  };
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

function backendHeaders() {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = import.meta.env.VITE_BACKEND_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export async function runRag(userId: string, userInput: string, topK = 3) {
  const res = await fetch(apiUrl('/api/rag/run'), {
    method: 'POST',
    headers: backendHeaders(),
    body: JSON.stringify({ userId, userInput, topK }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `RAG failed: ${res.status}`);
  }
  return (await res.json()) as RagRunResponse;
}

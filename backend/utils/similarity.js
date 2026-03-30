export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function parseEmbedding(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map((n) => Number(n));
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        return JSON.parse(s).map((n) => Number(n));
      } catch {
        const inner = s.slice(1, -1);
        const parts = inner.split(',').map((p) => p.trim()).filter(Boolean);
        return parts.map((n) => Number(n));
      }
    }
    return null;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.data)) return value.data.map((n) => Number(n));
  }
  return null;
}

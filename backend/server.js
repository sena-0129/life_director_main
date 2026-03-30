import express from 'express';
import { loadEnv, getEnv, requireEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { ragRoutes } from './routes/ragRoutes.js';
import { storyRoutes } from './routes/storyRoutes.js';

loadEnv();

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/debug/models', async (_req, res) => {
  try {
    const baseURL = getEnv('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const apiKey = requireEnv('DASHSCOPE_API_KEY');
    const resp = await fetch(`${baseURL}/models`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    });
    const text = await resp.text();
    if (!resp.ok) {
      res.status(resp.status).send(text);
      return;
    }
    res.type('application/json').send(text);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.post('/debug/embedding', async (req, res) => {
  try {
    const text = String(req.body?.text || '');
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    const baseURL = getEnv('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const apiKey = requireEnv('DASHSCOPE_API_KEY');
    const model = requireEnv('DASHSCOPE_EMBEDDING_MODEL');
    const dimensionsRaw = getEnv('DASHSCOPE_EMBEDDING_DIMENSIONS');
    const dimensions = dimensionsRaw ? Number(dimensionsRaw) : undefined;
    const resp = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        ...(dimensions && Number.isFinite(dimensions) ? { dimensions } : {}),
        encoding_format: 'float',
      }),
    });
    if (!resp.ok) {
      const msg = await resp.text().catch(() => '');
      res.status(resp.status).send(msg);
      return;
    }
    const r = await resp.json();
    const emb = r?.data?.[0]?.embedding || [];
    res.json({ model, dimensions: emb.length });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

app.use('/rag', ragRoutes);
app.use('/story', storyRoutes);

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'internal error' });
});

const port = Number(getEnv('RAG_PORT', getEnv('PORT', 4000)));
app.listen(port, () => {
  logger.info(`RAG backend listening on http://localhost:${port}`);
});

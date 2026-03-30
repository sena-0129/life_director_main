import express from 'express';
import { addStory } from '../services/memoryService.js';

export const storyRoutes = express.Router();

storyRoutes.post('/add', async (req, res) => {
  try {
    const { userId, content, tags, year } = req.body || {};
    if (!userId || !content) {
      res.status(400).json({ error: 'userId and content are required' });
      return;
    }
    const result = await addStory({ userId: String(userId), content: String(content), tags, year });
    res.json({ ok: true, story: result });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

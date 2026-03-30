import express from 'express';
import { retrieveRelatedStories, buildPrompt } from '../services/ragService.js';
import { generateStory } from '../services/llmService.js';

export const ragRoutes = express.Router();

ragRoutes.post('/run', async (req, res) => {
  try {
    const { userId, userInput, topK } = req.body || {};
    if (!userId || !userInput) {
      res.status(400).json({ error: 'userId and userInput are required' });
      return;
    }

    const { relatedStories, totalStories, embeddedStories, embeddingDimensions } = await retrieveRelatedStories({
      userId: String(userId),
      userInput: String(userInput),
      topK: Number(topK) > 0 ? Number(topK) : 3,
    });

    const prompt = buildPrompt(String(userInput), relatedStories);
    const enhanced = await generateStory(prompt);

    res.json({
      original: String(userInput),
      enhanced,
      meta: {
        totalStories: totalStories ?? 0,
        embeddedStories: embeddedStories ?? 0,
        embeddingDimensions: embeddingDimensions ?? null,
      },
      relatedStories: relatedStories.map((s) => ({
        id: s.id,
        year: s.year,
        tags: s.tags,
        content: s.content,
        score: s.score,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
});

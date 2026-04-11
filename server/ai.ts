import { GoogleGenAI, Modality } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Db } from './db';

function getApiKey(name: string) {
  const key = process.env[name];
  return key && key.trim().length > 0 ? key : undefined;
}

function getGenAiKeyForChat() {
  return getApiKey('GEMINI_API_KEY') || getApiKey('API_KEY');
}

function getGenAiKeyForMedia() {
  return getApiKey('API_KEY') || getApiKey('GEMINI_API_KEY');
}

export async function aiChat(message: string) {
  const apiKey = getGenAiKeyForChat();
  if (!apiKey) throw new Error('Missing env: GEMINI_API_KEY');
  const ai = new GoogleGenAI({ apiKey });
  const chat = ai.chats.create({
    model: 'gemini-3.1-pro-preview',
    config: {
      systemInstruction:
        '你是一位贴心的人生导演，专门陪伴55-75岁的老年人。你的语气温和、耐心、充满共情。你会引导他们回忆往事，并对他们的故事给予温暖的回馈。请使用简洁易懂的中文。',
    },
  });
  const response = await chat.sendMessage({ message });
  return response.text;
}

export async function aiTts(text: string) {
  const apiKey = getGenAiKeyForChat();
  if (!apiKey) throw new Error('Missing env: GEMINI_API_KEY');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text: `请用温和、沉稳的长者语气朗读：${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) return null;
  return `data:audio/wav;base64,${base64Audio}`;
}

export async function aiVideoToDisk(params: {
  prompt: string;
  imageDataUrl?: string;
  aspectRatio: '16:9' | '9:16';
  db: Db;
  videosDir: string;
}) {
  const buf = await aiVideoBuffer({
    prompt: params.prompt,
    imageDataUrl: params.imageDataUrl,
    aspectRatio: params.aspectRatio,
  });
  if (!buf) return null;

  await fs.mkdir(params.videosDir, { recursive: true });

  const id = randomUUID();
  const filePath = path.join(params.videosDir, `${id}.mp4`);
  await fs.writeFile(filePath, buf);

  params.db
    .prepare('insert into ai_videos (id, file_path, created_at) values (?, ?, ?)')
    .run(id, filePath, Date.now());

  return { id };
}

export async function aiVideoBuffer(params: {
  prompt: string;
  imageDataUrl?: string;
  aspectRatio: '16:9' | '9:16';
}) {
  const apiKey = getGenAiKeyForMedia();
  if (!apiKey) throw new Error('Missing env: GEMINI_API_KEY (or API_KEY for video)');

  const ai = new GoogleGenAI({ apiKey });

  const videoConfig: any = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: `怀旧纪实风格，充满温情：${params.prompt}`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: params.aspectRatio,
    },
  };

  if (params.imageDataUrl) {
    videoConfig.image = {
      imageBytes: params.imageDataUrl.split(',')[1],
      mimeType: 'image/png',
    };
  }

  let operation = await ai.models.generateVideos(videoConfig);

  const startedAt = Date.now();
  while (!operation.done) {
    if (Date.now() - startedAt > 20 * 60 * 1000) {
      throw new Error('Video generation timeout');
    }
    await new Promise((r) => setTimeout(r, 5000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) return null;

  const res = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
  });
  if (!res.ok) {
    throw new Error(`Video download failed: ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

import { GoogleGenAI, Modality } from "@google/genai";

const apiBaseUrl = import.meta.env.DEV ? (import.meta.env.VITE_API_BASE_URL || '') : '';
const useBackend = import.meta.env.VITE_USE_BACKEND === 'true' || (import.meta.env.DEV && apiBaseUrl.length > 0);

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

function backendHeaders() {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = import.meta.env.VITE_BACKEND_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const userKey = localStorage.getItem('life_director_user_key_v1');
  if (userKey) headers['x-user-key'] = userKey;
  return headers;
}

export async function chatWithAI(message: string, history: any[] = []) {
  if (useBackend) {
    const res = await fetch(apiUrl('/api/ai/chat'), {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({ message, history }),
    });
    if (!res.ok) throw new Error(`AI chat failed: ${res.status}`);
    const data = await res.json();
    return data.text as string;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const chat = ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: "你是一位贴心的人生导演，专门陪伴55-75岁的老年人。你的语气温和、耐心、充满共情。你会引导他们回忆往事，并对他们的故事给予温暖的回馈。请使用简洁易懂的中文。",
    },
  });

  const response = await chat.sendMessage({ message });
  return response.text;
}

export async function textToSpeech(text: string) {
  if (useBackend) {
    const res = await fetch(apiUrl('/api/ai/tts'), {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
    const data = await res.json();
    return (data.audioDataUrl ?? null) as string | null;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `请用温和、沉稳的长者语气朗读：${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is a good warm voice
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/wav;base64,${base64Audio}`;
  }
  return null;
}

// For Video models, we need to check for API key selection
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export async function generateLifeVideo(prompt: string, imageBase64?: string, aspectRatio: "16:9" | "9:16" = "16:9") {
  if (useBackend) {
    const res = await fetch(apiUrl('/api/ai/video'), {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({ prompt, imageDataUrl: imageBase64, aspectRatio }),
    });
    if (!res.ok) throw new Error(`Video generation failed: ${res.status}`);
    const data = await res.json();
    const videoUrl = data.videoUrl as string | undefined;
    if (!videoUrl) return null;

    const startedAt = Date.now();
    while (true) {
      const download = await fetch(apiUrl(videoUrl), { headers: backendHeaders() });
      if (download.status === 202) {
        if (Date.now() - startedAt > 25 * 60 * 1000) throw new Error('Video generation timeout');
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      if (!download.ok) throw new Error(`Video download failed: ${download.status}`);
      const blob = await download.blob();
      return URL.createObjectURL(blob);
    }
  }

  if (!window.aistudio) {
    throw new Error('Video generation requires backend or AI Studio runtime');
  }

  const hasKey = await window.aistudio.hasSelectedApiKey();
  if (!hasKey) {
    await window.aistudio.openSelectKey();
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const videoConfig: any = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: `怀旧纪实风格，充满温情：${prompt}`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
    }
  };

  if (imageBase64) {
    videoConfig.image = {
      imageBytes: imageBase64.split(',')[1],
      mimeType: 'image/png'
    };
  }

  let operation = await ai.models.generateVideos(videoConfig);

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (downloadLink) {
    const response = await fetch(downloadLink, {
      method: 'GET',
      headers: {
        'x-goog-api-key': process.env.API_KEY || '',
      },
    });
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
  return null;
}

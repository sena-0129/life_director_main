import { LifeProfile, LifeStory } from '../types';

const PROFILES_KEY = 'life_director_profiles';
const ACTIVE_PROFILE_ID_KEY = 'life_director_active_id';
const STORIES_KEY = 'life_director_stories';

const USER_KEY_STORAGE_KEY = 'life_director_user_key_v1';

const apiBaseUrl = import.meta.env.DEV ? (import.meta.env.VITE_API_BASE_URL || '') : '';
const useBackend = import.meta.env.VITE_USE_BACKEND === 'true' || (import.meta.env.DEV && apiBaseUrl.length > 0);

function getOrCreateUserKey() {
  const existing = localStorage.getItem(USER_KEY_STORAGE_KEY);
  if (existing) return existing;
  const next = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
    ? (globalThis.crypto as Crypto).randomUUID()
    : `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(USER_KEY_STORAGE_KEY, next);
  return next;
}

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

export const storage = {
  migrateLocalToBackendOnce: async (): Promise<void> => {
    if (!useBackend) return;
    const migratedKey = 'life_director_migrated_to_backend_v1';
    if (localStorage.getItem(migratedKey) === 'true') return;

    const rawProfiles = localStorage.getItem(PROFILES_KEY);
    const rawStories = localStorage.getItem(STORIES_KEY);

    try {
      if (!rawProfiles && !rawStories) return;

      const profiles: LifeProfile[] = rawProfiles ? JSON.parse(rawProfiles) : [];
      const stories: LifeStory[] = rawStories ? JSON.parse(rawStories) : [];

      for (const p of profiles) {
        try {
          await storage.saveProfile(p);
        } catch {
        }
      }
      for (const s of stories) {
        try {
          await storage.saveStory(s);
        } catch {
        }
      }
    } finally {
      localStorage.removeItem(PROFILES_KEY);
      localStorage.removeItem(STORIES_KEY);
      localStorage.removeItem(ACTIVE_PROFILE_ID_KEY);
      localStorage.setItem(migratedKey, 'true');
    }
  },
  getProfiles: async (): Promise<LifeProfile[]> => {
    if (!useBackend) {
      const data = localStorage.getItem(PROFILES_KEY);
      return data ? JSON.parse(data) : [];
    }
    const res = await fetch(apiUrl('/api/profiles'), { headers: backendHeaders() });
    if (!res.ok) throw new Error(`getProfiles failed: ${res.status}`);
    return (await res.json()) as LifeProfile[];
  },
  saveProfile: async (profile: LifeProfile): Promise<LifeProfile> => {
    if (!useBackend) {
      const profiles = await storage.getProfiles();
      const index = profiles.findIndex(p => p.id === profile.id);
      if (index > -1) {
        profiles[index] = profile;
      } else {
        profiles.push(profile);
      }
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      localStorage.setItem(ACTIVE_PROFILE_ID_KEY, profile.id);
      return profile;
    }

    const check = await fetch(apiUrl(`/api/profiles/${encodeURIComponent(profile.id)}`), { headers: backendHeaders() });
    const method = check.status === 404 ? 'POST' : 'PUT';
    const url = method === 'POST' ? apiUrl('/api/profiles') : apiUrl(`/api/profiles/${encodeURIComponent(profile.id)}`);
    const res = await fetch(url, {
      method,
      headers: backendHeaders(),
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error(`saveProfile failed: ${res.status}`);
    const saved = (await res.json()) as LifeProfile;
    localStorage.setItem(ACTIVE_PROFILE_ID_KEY, saved.id);
    return saved;
  },
  getActiveProfile: async (): Promise<LifeProfile | null> => {
    const activeId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
    if (!activeId) return null;
    if (!useBackend) {
      const profiles = await storage.getProfiles();
      return profiles.find(p => p.id === activeId) || null;
    }
    const res = await fetch(apiUrl(`/api/profiles/${encodeURIComponent(activeId)}`), { headers: backendHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`getActiveProfile failed: ${res.status}`);
    return (await res.json()) as LifeProfile;
  },
  setActiveProfile: async (id: string): Promise<void> => {
    localStorage.setItem(ACTIVE_PROFILE_ID_KEY, id);
  },
  deleteProfile: async (id: string): Promise<void> => {
    if (!useBackend) {
      const profiles = (await storage.getProfiles()).filter(p => p.id !== id);
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));

      const stories = (await storage.getAllStories()).filter(s => s.profileId !== id);
      localStorage.setItem(STORIES_KEY, JSON.stringify(stories));

      const activeId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
      if (activeId === id) {
        localStorage.removeItem(ACTIVE_PROFILE_ID_KEY);
      }
      return;
    }

    const res = await fetch(apiUrl(`/api/profiles/${encodeURIComponent(id)}`), { method: 'DELETE', headers: backendHeaders() });
    if (!res.ok) throw new Error(`deleteProfile failed: ${res.status}`);
    const activeId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
    if (activeId === id) {
      localStorage.removeItem(ACTIVE_PROFILE_ID_KEY);
    }
  },
  getAllStories: async (): Promise<LifeStory[]> => {
    if (!useBackend) {
      const data = localStorage.getItem(STORIES_KEY);
      return data ? JSON.parse(data) : [];
    }
    const profiles = await storage.getProfiles();
    const all: LifeStory[] = [];
    for (const p of profiles) {
      const stories = await storage.getStories(p.id);
      all.push(...stories);
    }
    return all;
  },
  getStories: async (profileId: string): Promise<LifeStory[]> => {
    if (!useBackend) {
      return (await storage.getAllStories()).filter(s => s.profileId === profileId);
    }
    const res = await fetch(apiUrl(`/api/profiles/${encodeURIComponent(profileId)}/stories`), { headers: backendHeaders() });
    if (!res.ok) throw new Error(`getStories failed: ${res.status}`);
    return (await res.json()) as LifeStory[];
  },
  saveStory: async (story: LifeStory): Promise<LifeStory> => {
    if (!useBackend) {
      const stories = await storage.getAllStories();
      const existingIndex = stories.findIndex(s => s.id === story.id);
      if (existingIndex > -1) {
        stories[existingIndex] = story;
      } else {
        stories.push(story);
      }
      localStorage.setItem(STORIES_KEY, JSON.stringify(stories));
      return story;
    }

    let isNew = !story.id || story.id <= 0;
    if (!isNew) {
      const check = await fetch(apiUrl(`/api/stories/${encodeURIComponent(String(story.id))}`), { headers: backendHeaders() });
      if (check.status === 404) {
        isNew = true;
      } else if (!check.ok) {
        throw new Error(`checkStory failed: ${check.status}`);
      }
    }

    const url = isNew
      ? apiUrl(`/api/profiles/${encodeURIComponent(story.profileId)}/stories`)
      : apiUrl(`/api/stories/${encodeURIComponent(String(story.id))}`);
    const method = isNew ? 'POST' : 'PUT';
    const payload: any = { ...story };
    delete payload.id;
    delete payload.profileId;

    const res = await fetch(url, {
      method,
      headers: backendHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`saveStory failed: ${res.status}`);
    return (await res.json()) as LifeStory;
  },
  deleteStory: async (id: number): Promise<void> => {
    if (!useBackend) {
      const stories = (await storage.getAllStories()).filter(s => s.id !== id);
      localStorage.setItem(STORIES_KEY, JSON.stringify(stories));
      return;
    }
    const res = await fetch(apiUrl(`/api/stories/${encodeURIComponent(String(id))}`), { method: 'DELETE', headers: backendHeaders() });
    if (!res.ok) throw new Error(`deleteStory failed: ${res.status}`);
  },
  clearAll: async (): Promise<void> => {
    localStorage.removeItem(PROFILES_KEY);
    localStorage.removeItem(ACTIVE_PROFILE_ID_KEY);
    localStorage.removeItem(STORIES_KEY);
  }
};

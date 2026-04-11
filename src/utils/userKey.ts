const USER_KEY_STORAGE_KEY = 'life_director_user_key_v1';

export function getOrCreateUserKey() {
  const existing = localStorage.getItem(USER_KEY_STORAGE_KEY);
  if (existing) return existing;
  const next = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
    ? (globalThis.crypto as Crypto).randomUUID()
    : `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(USER_KEY_STORAGE_KEY, next);
  return next;
}


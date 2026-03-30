import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

export function loadEnv() {
  const root = process.cwd();
  const candidates = [path.join(root, '.env.local'), path.join(root, '.env')];
  for (const p of candidates) {
    if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
  }
}

export function getEnv(name, fallback) {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

export function requireEnv(name) {
  const v = getEnv(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

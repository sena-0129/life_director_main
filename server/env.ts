import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

export function loadEnv() {
  const root = process.cwd();
  const candidates = [
    path.join(root, '.env.local'),
    path.join(root, '.env'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
    }
  }
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

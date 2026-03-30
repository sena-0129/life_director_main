import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Db } from './db';

export function sanitizeFileName(name: string) {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

export async function sha256File(filePath: string) {
  const hash = crypto.createHash('sha256');
  const buf = await fs.readFile(filePath);
  hash.update(buf);
  return hash.digest('hex');
}

export function sha256Buffer(buf: Buffer) {
  const hash = crypto.createHash('sha256');
  hash.update(buf);
  return hash.digest('hex');
}

export async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

export function insertUpload(db: Db, row: {
  id: string;
  profileId?: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  sha256: string;
  storagePath: string;
}) {
  db.prepare(
    'insert into uploads (id, profile_id, original_name, stored_name, mime_type, size, sha256, storage_path, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    row.id,
    row.profileId ?? null,
    row.originalName,
    row.storedName,
    row.mimeType,
    row.size,
    row.sha256,
    row.storagePath,
    Date.now(),
  );
}

export function uploadRowToJson(row: any) {
  return {
    id: row.id,
    profileId: row.profile_id ?? undefined,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: row.size,
    sha256: row.sha256,
    createdAt: row.created_at,
  };
}

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type Db = Database.Database;

export function openDb(dbPath: string) {
  const absPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const db = new Database(absPath);
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

function migrate(db: Db) {
  db.exec(`
    create table if not exists profiles (
      id text primary key,
      name text not null,
      birth_date text not null,
      birth_place text not null,
      gender text not null,
      occupation text not null,
      cities_json text not null,
      avatar text not null,
      bio text not null,
      created_at integer not null,
      updated_at integer not null
    );

    create table if not exists stories (
      id integer primary key autoincrement,
      profile_id text not null,
      title text not null,
      stage text not null,
      year text not null,
      age integer not null,
      emotion text not null,
      tags_json text not null,
      content text not null,
      timestamp integer not null,
      cover_image text,
      created_at integer not null,
      updated_at integer not null,
      foreign key(profile_id) references profiles(id) on delete cascade
    );

    create table if not exists ai_videos (
      id text primary key,
      file_path text not null,
      created_at integer not null
    );

    create table if not exists uploads (
      id text primary key,
      profile_id text,
      original_name text not null,
      stored_name text not null,
      mime_type text not null,
      size integer not null,
      sha256 text not null,
      storage_path text not null,
      created_at integer not null,
      foreign key(profile_id) references profiles(id) on delete set null
    );
  `);
}

export function rowToProfile(row: any) {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    birthPlace: row.birth_place,
    gender: row.gender,
    occupation: row.occupation,
    cities: JSON.parse(row.cities_json ?? '[]'),
    avatar: row.avatar,
    bio: row.bio,
  };
}

export function rowToStory(row: any) {
  return {
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    stage: row.stage,
    year: row.year,
    age: row.age,
    emotion: row.emotion,
    tags: JSON.parse(row.tags_json ?? '[]'),
    content: row.content,
    timestamp: row.timestamp,
  };
}

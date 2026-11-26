import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
mkdirSync(DATA_DIR, { recursive: true });

const USE_TURSO = !!(process.env.TURSO_DATABASE_URL);
const DB_PATH = join(DATA_DIR, 'trainapp.db');

let local = null;
let client = null;

if (USE_TURSO) {
  // @libsql/client/web — чистый JS (hrana over fetch), работает и в Node, и на хостинге
  const { createClient } = await import('@libsql/client/web');
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
} else {
  const { DatabaseSync } = await import('node:sqlite');
  local = new DatabaseSync(DB_PATH);
  local.exec('PRAGMA journal_mode = WAL;');
  local.exec('PRAGMA foreign_keys = ON;');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT,
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER,
  weight REAL,
  reps INTEGER,
  duration_sec INTEGER,
  distance REAL,
  rest_sec INTEGER,
  rpe REAL
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  kind TEXT,
  ocr_raw TEXT,
  parsed_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  duration_weeks INTEGER,
  description TEXT,
  plan_json TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export async function init() {
  if (USE_TURSO) {
    await client.executeMultiple(SCHEMA);
  } else {
    local.exec(SCHEMA);
  }
}

export async function all(sql, params = []) {
  if (USE_TURSO) {
    const r = await client.execute({ sql, args: params });
    return r.rows;
  }
  return local.prepare(sql).all(...params);
}

export async function get(sql, params = []) {
  if (USE_TURSO) {
    const r = await client.execute({ sql, args: params });
    return r.rows[0];
  }
  return local.prepare(sql).get(...params);
}

export async function run(sql, params = []) {
  if (USE_TURSO) {
    const r = await client.execute({ sql, args: params });
    return { lastInsertRowid: Number(r.lastInsertRowid), changes: r.rowsAffected };
  }
  const info = local.prepare(sql).run(...params);
  return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
}

export async function getWorkoutFull(id) {
  const workout = await get('SELECT * FROM workouts WHERE id = ?', [id]);
  if (!workout) return null;
  const exercises = await all(
    'SELECT * FROM exercises WHERE workout_id = ? ORDER BY order_index, id',
    [id]
  );
  for (const ex of exercises) {
    ex.sets = await all(
      'SELECT * FROM sets WHERE exercise_id = ? ORDER BY set_number, id',
      [ex.id]
    );
  }
  workout.exercises = exercises;
  workout.media = await all('SELECT * FROM media WHERE workout_id = ?', [id]);
  return workout;
}

export { USE_TURSO };

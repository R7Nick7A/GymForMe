import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, 'data-migtest');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

// Создаём «старую» (однопользовательскую) схему с данными
const old = new DatabaseSync(join(dir, 'trainapp.db'));
old.exec(`
CREATE TABLE workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, date TEXT NOT NULL, type TEXT, source TEXT DEFAULT 'manual', notes TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER, name TEXT, order_index INTEGER DEFAULT 0, notes TEXT);
CREATE TABLE sets (id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER, set_number INTEGER, weight REAL, reps INTEGER);
CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER, filename TEXT, original_name TEXT, kind TEXT, ocr_raw TEXT, parsed_json TEXT, created_at TEXT);
CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, content TEXT, created_at TEXT);
CREATE TABLE plans (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, duration_weeks INTEGER, description TEXT, plan_json TEXT, status TEXT, created_at TEXT);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
INSERT INTO workouts (title, date) VALUES ('Old workout', '2026-01-01');
INSERT INTO settings (key, value) VALUES ('gemini_api_key', 'OLDKEY123');
`);
old.close();

process.env.DATA_DIR = dir;
const db = await import('./db.js');
await db.init();

const cols = await db.all('PRAGMA table_info(workouts)');
console.log('workouts.user_id added:', cols.some((c) => c.name === 'user_id'));
const scols = await db.all('PRAGMA table_info(settings)');
console.log('settings.user_id added:', scols.some((c) => c.name === 'user_id'));
const s = await db.get("SELECT * FROM settings WHERE key = 'gemini_api_key'");
console.log('settings preserved:', JSON.stringify(s));
const w = await db.get('SELECT * FROM workouts');
console.log('workout preserved:', JSON.stringify(w));
console.log('MIGRATION OK');

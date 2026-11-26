import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, run, getWorkoutFull, init } from './db.js';
import * as ai from './ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

function parseBody(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback === undefined ? null : fallback;
  return value;
}

// ---------- health ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: process.env.TURSO_DATABASE_URL ? 'turso' : 'sqlite', time: new Date().toISOString() });
});

// ---------- workouts ----------
app.get('/api/workouts', async (req, res) => {
  try {
    const rows = await all(
      `SELECT w.*,
        (SELECT COUNT(*) FROM exercises e WHERE e.workout_id = w.id) AS exercise_count,
        (SELECT COUNT(*) FROM sets s JOIN exercises e ON e.id = s.exercise_id WHERE e.workout_id = w.id) AS set_count
       FROM workouts w ORDER BY date DESC, id DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workouts', async (req, res) => {
  try {
    const { title, date, type, source, notes, exercises } = req.body || {};
    if (!title || !date) return res.status(400).json({ error: 'title and date are required' });
    const info = await run(
      'INSERT INTO workouts (title, date, type, source, notes) VALUES (?, ?, ?, ?, ?)',
      [title, date, parseBody(type, null), parseBody(source, 'manual'), parseBody(notes, null)]
    );
    const workoutId = info.lastInsertRowid;

    if (Array.isArray(exercises)) {
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        const exInfo = await run(
          'INSERT INTO exercises (workout_id, name, order_index, notes) VALUES (?, ?, ?, ?)',
          [workoutId, ex.name, i, parseBody(ex.notes, null)]
        );
        const exerciseId = exInfo.lastInsertRowid;
        if (Array.isArray(ex.sets)) {
          for (const s of ex.sets) {
            await run(
              'INSERT INTO sets (exercise_id, set_number, weight, reps, duration_sec, distance, rest_sec, rpe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                exerciseId,
                parseBody(s.set_number, null),
                parseBody(s.weight, null),
                parseBody(s.reps, null),
                parseBody(s.duration_sec, null),
                parseBody(s.distance, null),
                parseBody(s.rest_sec, null),
                parseBody(s.rpe, null),
              ]
            );
          }
        }
      }
    }
    res.status(201).json(await getWorkoutFull(workoutId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/workouts/:id', async (req, res) => {
  try {
    const w = await getWorkoutFull(Number(req.params.id));
    if (!w) return res.status(404).json({ error: 'not found' });
    res.json(w);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/workouts/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await get('SELECT * FROM workouts WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { title, date, type, source, notes } = req.body || {};
    await run('UPDATE workouts SET title = ?, date = ?, type = ?, source = ?, notes = ? WHERE id = ?', [
      parseBody(title, existing.title),
      parseBody(date, existing.date),
      parseBody(type, existing.type),
      parseBody(source, existing.source),
      parseBody(notes, existing.notes),
      id,
    ]);
    res.json(await getWorkoutFull(id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/workouts/:id', async (req, res) => {
  try {
    await run('DELETE FROM workouts WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- exercises / sets ----------
app.post('/api/workouts/:id/exercises', async (req, res) => {
  try {
    const workoutId = Number(req.params.id);
    const existing = await get('SELECT id FROM workouts WHERE id = ?', [workoutId]);
    if (!existing) return res.status(404).json({ error: 'workout not found' });
    const { name, notes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const maxOrder = await get('SELECT COALESCE(MAX(order_index), -1) AS m FROM exercises WHERE workout_id = ?', [workoutId]);
    const info = await run('INSERT INTO exercises (workout_id, name, order_index, notes) VALUES (?, ?, ?, ?)', [
      workoutId, name, maxOrder.m + 1, parseBody(notes, null),
    ]);
    res.status(201).json(await get('SELECT * FROM exercises WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/exercises/:id/sets', async (req, res) => {
  try {
    const exerciseId = Number(req.params.id);
    const existing = await get('SELECT id FROM exercises WHERE id = ?', [exerciseId]);
    if (!existing) return res.status(404).json({ error: 'exercise not found' });
    const s = req.body || {};
    const maxNum = await get('SELECT COALESCE(MAX(set_number), 0) AS m FROM sets WHERE exercise_id = ?', [exerciseId]);
    const info = await run(
      'INSERT INTO sets (exercise_id, set_number, weight, reps, duration_sec, distance, rest_sec, rpe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        exerciseId,
        parseBody(s.set_number, maxNum.m + 1),
        parseBody(s.weight, null),
        parseBody(s.reps, null),
        parseBody(s.duration_sec, null),
        parseBody(s.distance, null),
        parseBody(s.rest_sec, null),
        parseBody(s.rpe, null),
      ]
    );
    res.status(201).json(await get('SELECT * FROM sets WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/exercises/:id', async (req, res) => {
  try {
    await run('DELETE FROM exercises WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sets/:id', async (req, res) => {
  try {
    await run('DELETE FROM sets WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- media ----------
app.post('/api/media', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const { workout_id, kind } = req.body || {};
    const info = await run(
      'INSERT INTO media (workout_id, filename, original_name, kind) VALUES (?, ?, ?, ?)',
      [workout_id ? Number(workout_id) : null, req.file.filename, req.file.originalname, parseBody(kind, 'photo')]
    );
    res.status(201).json(await get('SELECT * FROM media WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/media/:id/file', async (req, res) => {
  try {
    const m = await get('SELECT * FROM media WHERE id = ?', [Number(req.params.id)]);
    if (!m) return res.status(404).json({ error: 'not found' });
    res.sendFile(join(UPLOAD_DIR, m.filename));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- stats ----------
app.get('/api/stats/summary', async (req, res) => {
  try {
    const totalWorkouts = (await get('SELECT COUNT(*) AS c FROM workouts')).c;
    const last7 = (await get("SELECT COUNT(*) AS c FROM workouts WHERE date >= date('now','-7 days')")).c;
    const last30 = (await get("SELECT COUNT(*) AS c FROM workouts WHERE date >= date('now','-30 days')")).c;
    const volumeByDay = await all(
      `SELECT w.date, COALESCE(SUM(s.weight * s.reps), 0) AS volume
       FROM workouts w
       JOIN exercises e ON e.workout_id = w.id
       JOIN sets s ON s.exercise_id = e.id
       WHERE s.weight IS NOT NULL AND s.reps IS NOT NULL
       GROUP BY w.date ORDER BY w.date`
    );
    const exerciseFrequency = await all(
      `SELECT e.name, COUNT(*) AS cnt, MAX(s.weight) AS max_weight, MAX(s.reps) AS max_reps
       FROM exercises e
       JOIN sets s ON s.exercise_id = e.id
       GROUP BY e.name ORDER BY cnt DESC LIMIT 20`
    );
    res.json({ totalWorkouts, last7, last30, volumeByDay, exerciseFrequency });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- messages (assistant chat) ----------
app.get('/api/messages', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM messages ORDER BY id'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { content } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content is required' });
    const info = await run('INSERT INTO messages (role, content) VALUES (?, ?)', ['user', content]);
    const userMsg = await get('SELECT * FROM messages WHERE id = ?', [info.lastInsertRowid]);

    let replyText;
    try {
      const history = await all('SELECT role, content FROM messages ORDER BY id');
      const appContext = await ai.buildAppContext();
      replyText = await ai.assistantChat(history, appContext);
    } catch (e) {
      replyText = `Не удалось получить ответ от ИИ: ${e.message}`;
    }
    const replyInfo = await run('INSERT INTO messages (role, content) VALUES (?, ?)', ['assistant', replyText]);
    res.status(201).json({ user: userMsg, assistant: await get('SELECT * FROM messages WHERE id = ?', [replyInfo.lastInsertRowid]) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- AI ----------
app.post('/api/ai/parse-image', async (req, res) => {
  try {
    const { base64, mimeType } = req.body || {};
    if (!base64) return res.status(400).json({ error: 'base64 is required' });
    res.json(await ai.analyzeImage(base64, mimeType));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/parse-text', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text is required' });
    res.json(await ai.parseWorkoutText(text));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ai/forecast', async (req, res) => {
  try {
    res.json({ forecast: await ai.forecastProgress() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/plans', async (req, res) => {
  try {
    const { goal } = req.body || {};
    const plan = await ai.suggestPlan(goal);
    const info = await run(
      'INSERT INTO plans (title, duration_weeks, description, plan_json, status) VALUES (?, ?, ?, ?, ?)',
      [plan.title || 'План', plan.duration_weeks || null, plan.description || null, JSON.stringify(plan), 'active']
    );
    res.status(201).json(await get('SELECT * FROM plans WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/plans', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM plans ORDER BY id DESC'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/plans/:id', async (req, res) => {
  try {
    await run('DELETE FROM plans WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- settings ----------
app.get('/api/settings', async (req, res) => {
  try {
    const rows = await all('SELECT key, value FROM settings');
    const values = {};
    for (const r of rows) values[r.key] = r.value;
    res.json({ geminiConfigured: await ai.isConfigured(), values });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    for (const [k, v] of Object.entries(req.body || {})) {
      await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, String(v)]);
    }
    res.json({ ok: true, geminiConfigured: await ai.isConfigured() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- static frontend ----------
const frontendDist = join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Frontend not built yet. Run: npm run build in frontend/' });
  });
});

const PORT = process.env.PORT || 3100;

await init();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TrainApp backend listening on http://0.0.0.0:${PORT} (storage: ${process.env.TURSO_DATABASE_URL ? 'turso' : 'sqlite'})`);
});

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, run, getWorkoutFull, init } from './db.js';
import * as ai from './ai.js';
import { hashPassword, verifyPassword, generateToken, generateRecoveryCode } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_USERS = 100;

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

// ---------- auth middleware ----------
async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const session = await get('SELECT user_id FROM sessions WHERE token = ?', [token]);
    if (!session) return res.status(401).json({ error: 'unauthorized' });
    req.userId = session.user_id;
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function ownsWorkout(workoutId, userId) {
  return !!(await get('SELECT id FROM workouts WHERE id = ? AND user_id = ?', [workoutId, userId]));
}
async function ownsExercise(exerciseId, userId) {
  return !!(await get(
    'SELECT e.id FROM exercises e JOIN workouts w ON w.id = e.workout_id WHERE e.id = ? AND w.user_id = ?',
    [exerciseId, userId]
  ));
}
async function ownsSet(setId, userId) {
  return !!(await get(
    'SELECT s.id FROM sets s JOIN exercises e ON e.id = s.exercise_id JOIN workouts w ON w.id = e.workout_id WHERE s.id = ? AND w.user_id = ?',
    [setId, userId]
  ));
}

// ---------- auth routes ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const name = String(username || '').trim();
    if (name.length < 2 || name.length > 32) return res.status(400).json({ error: 'Имя должно быть от 2 до 32 символов' });
    if (!password || String(password).length < 4) return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });

    const count = await get('SELECT COUNT(*) AS c FROM users');
    if (Number(count.c) >= MAX_USERS) return res.status(403).json({ error: 'Достигнут лимит пользователей' });

    const exists = await get('SELECT id FROM users WHERE username = ?', [name]);
    if (exists) return res.status(409).json({ error: 'Такое имя уже занято' });

    const { hash, salt } = hashPassword(password);
    const recoveryCode = generateRecoveryCode();
    const info = await run(
      'INSERT INTO users (username, password_hash, password_salt, recovery_code) VALUES (?, ?, ?, ?)',
      [name, hash, salt, recoveryCode]
    );
    const userId = info.lastInsertRowid;

    // первый пользователь забирает «устаревшие» данные (если они остались от однопользовательской версии)
    if (Number(count.c) === 0) {
      for (const t of ['workouts', 'media', 'messages', 'plans']) {
        await run(`UPDATE ${t} SET user_id = ? WHERE user_id IS NULL`, [userId]);
      }
      await run('UPDATE settings SET user_id = ? WHERE user_id IS NULL', [userId]);
    }

    const token = generateToken();
    await run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, userId]);
    res.status(201).json({ token, username: name, recoveryCode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = await get('SELECT * FROM users WHERE username = ?', [String(username || '').trim()]);
    if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
      return res.status(401).json({ error: 'Неверное имя или пароль' });
    }
    const token = generateToken();
    await run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, user.id]);
    res.json({ token, username: user.username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await run('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/recover', async (req, res) => {
  try {
    const { username, recoveryCode, newPassword } = req.body || {};
    const user = await get('SELECT * FROM users WHERE username = ?', [String(username || '').trim()]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (!recoveryCode || String(recoveryCode).trim().toUpperCase() !== String(user.recovery_code || '').toUpperCase()) {
      return res.status(401).json({ error: 'Неверный код восстановления' });
    }
    if (!newPassword || String(newPassword).length < 4) return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });
    const { hash, salt } = hashPassword(newPassword);
    await run('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', [hash, salt, user.id]);
    // все старые сессии сбрасываем
    await run('DELETE FROM sessions WHERE user_id = ?', [user.id]);
    const token = generateToken();
    await run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, user.id]);
    res.json({ token, username: user.username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await get('SELECT id, username, created_at FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- health ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: process.env.TURSO_DATABASE_URL ? 'turso' : 'sqlite', time: new Date().toISOString() });
});

// ---------- workouts ----------
app.get('/api/workouts', requireAuth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT w.*,
        (SELECT COUNT(*) FROM exercises e WHERE e.workout_id = w.id) AS exercise_count,
        (SELECT COUNT(*) FROM sets s JOIN exercises e ON e.id = s.exercise_id WHERE e.workout_id = w.id) AS set_count
       FROM workouts w WHERE w.user_id = ? ORDER BY date DESC, id DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workouts', requireAuth, async (req, res) => {
  try {
    const { title, date, type, source, notes, exercises } = req.body || {};
    if (!title || !date) return res.status(400).json({ error: 'title and date are required' });
    const info = await run(
      'INSERT INTO workouts (user_id, title, date, type, source, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [req.userId, title, date, parseBody(type, null), parseBody(source, 'manual'), parseBody(notes, null)]
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
              [exerciseId, parseBody(s.set_number, null), parseBody(s.weight, null), parseBody(s.reps, null), parseBody(s.duration_sec, null), parseBody(s.distance, null), parseBody(s.rest_sec, null), parseBody(s.rpe, null)]
            );
          }
        }
      }
    }
    res.status(201).json(await getWorkoutFull(workoutId, req.userId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/workouts/:id', requireAuth, async (req, res) => {
  try {
    const w = await getWorkoutFull(Number(req.params.id), req.userId);
    if (!w) return res.status(404).json({ error: 'not found' });
    res.json(w);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/workouts/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await get('SELECT * FROM workouts WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { title, date, type, source, notes } = req.body || {};
    await run('UPDATE workouts SET title = ?, date = ?, type = ?, source = ?, notes = ? WHERE id = ? AND user_id = ?', [
      parseBody(title, existing.title), parseBody(date, existing.date), parseBody(type, existing.type),
      parseBody(source, existing.source), parseBody(notes, existing.notes), id, req.userId,
    ]);
    res.json(await getWorkoutFull(id, req.userId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/workouts/:id', requireAuth, async (req, res) => {
  try {
    await run('DELETE FROM workouts WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- exercises / sets ----------
app.post('/api/workouts/:id/exercises', requireAuth, async (req, res) => {
  try {
    const workoutId = Number(req.params.id);
    if (!(await ownsWorkout(workoutId, req.userId))) return res.status(404).json({ error: 'workout not found' });
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

app.post('/api/exercises/:id/sets', requireAuth, async (req, res) => {
  try {
    const exerciseId = Number(req.params.id);
    if (!(await ownsExercise(exerciseId, req.userId))) return res.status(404).json({ error: 'exercise not found' });
    const s = req.body || {};
    const maxNum = await get('SELECT COALESCE(MAX(set_number), 0) AS m FROM sets WHERE exercise_id = ?', [exerciseId]);
    const info = await run(
      'INSERT INTO sets (exercise_id, set_number, weight, reps, duration_sec, distance, rest_sec, rpe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [exerciseId, parseBody(s.set_number, maxNum.m + 1), parseBody(s.weight, null), parseBody(s.reps, null), parseBody(s.duration_sec, null), parseBody(s.distance, null), parseBody(s.rest_sec, null), parseBody(s.rpe, null)]
    );
    res.status(201).json(await get('SELECT * FROM sets WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/exercises/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await ownsExercise(id, req.userId))) return res.status(404).json({ error: 'not found' });
    await run('DELETE FROM exercises WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sets/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await ownsSet(id, req.userId))) return res.status(404).json({ error: 'not found' });
    await run('DELETE FROM sets WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- media ----------
app.post('/api/media', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const { workout_id, kind } = req.body || {};
    const wid = workout_id ? Number(workout_id) : null;
    if (wid && !(await ownsWorkout(wid, req.userId))) return res.status(404).json({ error: 'workout not found' });
    const info = await run(
      'INSERT INTO media (user_id, workout_id, filename, original_name, kind) VALUES (?, ?, ?, ?, ?)',
      [req.userId, wid, req.file.filename, req.file.originalname, parseBody(kind, 'photo')]
    );
    res.status(201).json(await get('SELECT * FROM media WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/media/:id/file', requireAuth, async (req, res) => {
  try {
    const m = await get('SELECT * FROM media WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
    if (!m) return res.status(404).json({ error: 'not found' });
    res.sendFile(join(UPLOAD_DIR, m.filename));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/media/:id', requireAuth, async (req, res) => {
  try {
    const m = await get('SELECT * FROM media WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
    if (!m) return res.status(404).json({ error: 'not found' });
    await run('DELETE FROM media WHERE id = ?', [m.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- stats ----------
app.get('/api/stats/summary', requireAuth, async (req, res) => {
  try {
    const uid = req.userId;
    const totalWorkouts = (await get('SELECT COUNT(*) AS c FROM workouts WHERE user_id = ?', [uid])).c;
    const last7 = (await get("SELECT COUNT(*) AS c FROM workouts WHERE user_id = ? AND date >= date('now','-7 days')", [uid])).c;
    const last30 = (await get("SELECT COUNT(*) AS c FROM workouts WHERE user_id = ? AND date >= date('now','-30 days')", [uid])).c;
    const volumeByDay = await all(
      `SELECT w.date, COALESCE(SUM(s.weight * s.reps), 0) AS volume
       FROM workouts w JOIN exercises e ON e.workout_id = w.id JOIN sets s ON s.exercise_id = e.id
       WHERE w.user_id = ? AND s.weight IS NOT NULL AND s.reps IS NOT NULL
       GROUP BY w.date ORDER BY w.date`,
      [uid]
    );
    const exerciseFrequency = await all(
      `SELECT e.name, COUNT(*) AS cnt, MAX(s.weight) AS max_weight, MAX(s.reps) AS max_reps
       FROM exercises e JOIN sets s ON s.exercise_id = e.id JOIN workouts w ON w.id = e.workout_id
       WHERE w.user_id = ? GROUP BY e.name ORDER BY cnt DESC LIMIT 20`,
      [uid]
    );
    res.json({ totalWorkouts, last7, last30, volumeByDay, exerciseFrequency });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- messages ----------
app.get('/api/messages', requireAuth, async (req, res) => {
  try {
    res.json(await all('SELECT * FROM messages WHERE user_id = ? ORDER BY id', [req.userId]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/messages', requireAuth, async (req, res) => {
  try {
    const { content } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content is required' });
    const info = await run('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)', [req.userId, 'user', content]);
    const userMsg = await get('SELECT * FROM messages WHERE id = ?', [info.lastInsertRowid]);

    let replyText;
    try {
      const history = (await all('SELECT role, content FROM messages WHERE user_id = ? ORDER BY id', [req.userId]))
        .filter((m) => !(m.role === 'assistant' && /не настроен|Не удалось получить ответ от ИИ/i.test(m.content)));
      const appContext = await ai.buildAppContext(req.userId);
      replyText = await ai.assistantChat(history, appContext, req.userId);
    } catch (e) {
      replyText = `Не удалось получить ответ от ИИ: ${e.message}`;
    }
    const replyInfo = await run('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)', [req.userId, 'assistant', replyText]);
    res.status(201).json({ user: userMsg, assistant: await get('SELECT * FROM messages WHERE id = ?', [replyInfo.lastInsertRowid]) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- AI ----------
app.post('/api/ai/parse-image', requireAuth, async (req, res) => {
  try {
    const { base64, mimeType } = req.body || {};
    if (!base64) return res.status(400).json({ error: 'base64 is required' });
    res.json(await ai.analyzeImage(base64, mimeType, req.userId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/parse-text', requireAuth, async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text is required' });
    res.json(await ai.parseWorkoutText(text, req.userId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ai/forecast', requireAuth, async (req, res) => {
  try {
    res.json({ forecast: await ai.forecastProgress(req.userId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/plans', requireAuth, async (req, res) => {
  try {
    const { goal } = req.body || {};
    const plan = await ai.suggestPlan(goal, req.userId);
    const info = await run(
      'INSERT INTO plans (user_id, title, duration_weeks, description, plan_json, status) VALUES (?, ?, ?, ?, ?, ?)',
      [req.userId, plan.title || 'План', plan.duration_weeks || null, plan.description || null, JSON.stringify(plan), 'active']
    );
    res.status(201).json(await get('SELECT * FROM plans WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/plans', requireAuth, async (req, res) => {
  try {
    res.json(await all('SELECT * FROM plans WHERE user_id = ? ORDER BY id DESC', [req.userId]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/plans/:id', requireAuth, async (req, res) => {
  try {
    await run('DELETE FROM plans WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- settings ----------
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const rows = await all("SELECT key, value FROM settings WHERE user_id = ? AND key != 'gemini_api_key'", [req.userId]);
    const values = {};
    for (const r of rows) values[r.key] = r.value;
    res.json({ geminiConfigured: await ai.isConfigured(req.userId), values });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings', requireAuth, async (req, res) => {
  try {
    for (const [k, v] of Object.entries(req.body || {})) {
      await run(
        'INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value',
        [req.userId, k, String(v)]
      );
    }
    res.json({ ok: true, geminiConfigured: await ai.isConfigured(req.userId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- static frontend ----------
const frontendDist = join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Frontend not built yet' });
  });
});

const PORT = process.env.PORT || 3100;

await init();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TrainApp backend listening on http://0.0.0.0:${PORT} (storage: ${process.env.TURSO_DATABASE_URL ? 'turso' : 'sqlite'})`);
});

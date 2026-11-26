import { all, get } from './db.js';

const DEFAULT_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function getApiKey() {
  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv) return fromEnv;
  try {
    const row = await get("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    return row?.value || '';
  } catch (_) {
    return '';
  }
}

export async function isConfigured() {
  return !!(await getApiKey());
}

async function callGeminiOnce(contents, model, { json = false, temperature } = {}) {
  const key = await getApiKey();
  if (!key) throw new Error('API-ключ Gemini не настроен. Добавь его в Настройках.');
  const url = `${BASE_URL}/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body = { contents, generationConfig: {} };
  if (json) body.generationConfig.responseMimeType = 'application/json';
  if (temperature !== undefined) body.generationConfig.temperature = temperature;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
  if (!out) throw new Error('Пустой ответ от Gemini');
  return out;
}

async function callGemini(contents, { json = false, model, temperature } = {}) {
  const models = model ? [model] : DEFAULT_MODELS;
  let lastErr;
  for (const m of models) {
    try {
      return await callGeminiOnce(contents, m, { json, temperature });
    } catch (e) {
      lastErr = e;
      const retryable = /503|429|UNAVAILABLE|high demand|overloaded|temporarily/i.test(e.message);
      if (!retryable) throw e;
    }
  }
  throw lastErr;
}

function parseJson(raw) {
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(s);
}

function imagePart(base64, mimeType) {
  return { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } };
}

const WORKOUT_SCHEMA = `{
  "title": "короткое название тренировки",
  "type": "strength|cardio|crossfit|stretching|other",
  "notes": "заметки/контекст, если есть",
  "exercises": [
    { "name": "название упражнения", "sets": [ { "weight": число_кг_или_null, "reps": число_или_null, "duration_sec": число_или_null, "distance": число_или_null } ] }
  ]
}`;

function parseInstruction() {
  return `Ты — спортивный аналитик. Твоя задача — разобрать описание тренировки и вернуть ТОЛЬКО валидный JSON без пояснений и markdown-обёрток.
Правила:
- Логически пойми структуру тренировки: какие упражнения, сколько подходов, вес, повторения.
- Не выдумывай данные, которых нет. Если что-то не указано — ставь null.
- Вес переводи в килограммы (если написано в фунтах/другом — пересчитай, это укажи в notes).
- Сгруппируй одинаковые упражнения в один элемент с несколькими подходами.
- Время в секундах, дистанция в километрах.
Формат ответа (строго такой JSON):
${WORKOUT_SCHEMA}`;
}

export async function analyzeImage(base64, mimeType) {
  const contents = [
    { role: 'user', parts: [{ text: parseInstruction() }, imagePart(base64, mimeType)] },
  ];
  const raw = await callGemini(contents, { json: true });
  return parseJson(raw);
}

export async function parseWorkoutText(inputText) {
  const contents = [
    { role: 'user', parts: [{ text: `${parseInstruction()}\n\nВот текст тренировки:\n"""\n${inputText}\n"""` }] },
  ];
  const raw = await callGemini(contents, { json: true });
  return parseJson(raw);
}

export async function buildAppContext() {
  const workouts = await all(
    `SELECT w.id, w.title, w.date, w.type, w.source, w.notes,
      (SELECT COUNT(*) FROM exercises e WHERE e.workout_id = w.id) AS ex_count
     FROM workouts w ORDER BY date DESC LIMIT 50`
  );
  const exercises = await all(
    `SELECT e.name, e.workout_id, s.weight, s.reps, w.date
     FROM exercises e JOIN sets s ON s.exercise_id = e.id JOIN workouts w ON w.id = e.workout_id
     ORDER BY w.date DESC LIMIT 500`
  );
  const plans = await all('SELECT id, title, duration_weeks, description, plan_json, status FROM plans ORDER BY id DESC LIMIT 10');
  const profile = await all("SELECT key, value FROM settings WHERE key != 'gemini_api_key'");
  return JSON.stringify({ workouts, exercises, plans, profile }, null, 2);
}

export async function assistantChat(messages, appContext) {
  const system = `Ты — персональный ИИ-тренер и аналитик в приложении «Тренер» для мониторинга тренировочного процесса.
Отвечай на русском, дружелюбно и по делу. Ты видишь все данные пользователя (ниже в JSON) и можешь анализировать их.
ВАЖНО: подключение к нейросети работает, API-ключ уже настроен. НИКОГДА не говори, что ключ, API или доступ к ИИ не настроены — это неверно.
Если тренировок в данных пока нет — просто скажи «пока нет записей» и предложи добавить тренировку. Не придумывай технические причины.
Ниже актуальное состояние приложения (JSON):
${appContext}`;
  const contents = [
    { role: 'user', parts: [{ text: system }] },
    ...messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
  ];
  return await callGemini(contents, { temperature: 0.7 });
}

export async function forecastProgress() {
  const appContext = await buildAppContext();
  const prompt = `Проанализируй историю тренировок (JSON ниже) и дай:
1) краткий анализ текущего прогресса,
2) прогноз развития на 1-2 месяца при сохранении режима,
3) 2-3 конкретные рекомендации.
Ответь связным текстом на русском, без JSON.
Данные:
${appContext}`;
  return await callGemini([{ role: 'user', parts: [{ text: prompt }] }], { temperature: 0.5 });
}

export async function suggestPlan(goal) {
  const appContext = await buildAppContext();
  let effectiveGoal = goal;
  if (!effectiveGoal) {
    const row = await get("SELECT value FROM settings WHERE key = 'profile_goal'");
    effectiveGoal = row?.value || '';
  }
  effectiveGoal = effectiveGoal || 'общая физическая форма';
  const prompt = `Составь тренировочный план на несколько недель с учётом данных пользователя (JSON ниже) и цели: "${effectiveGoal}".
Верни ТОЛЬКО валидный JSON без пояснений, структура:
{
  "title": "название плана",
  "duration_weeks": число,
  "description": "краткое описание подхода",
  "schedule": [
    { "week": число, "days": [ { "day": "понедельник", "focus": "цель дня", "exercises": ["упражнение 1", "упражнение 2"] } ] }
  ]
}
Данные:
${appContext}`;
  const raw = await callGemini([{ role: 'user', parts: [{ text: prompt }] }], { json: true });
  return parseJson(raw);
}

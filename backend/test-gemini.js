import { get, init } from './db.js';

await init();
const key = (await get("SELECT value FROM settings WHERE key = 'gemini_api_key'")).value;
if (!key) { console.log('NO_KEY'); process.exit(1); }

const models = [
  'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite',
  'gemini-2.5-pro', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview',
  'gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-3.7-flash',
];

for (const model of models) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body = { contents: [{ role: 'user', parts: [{ text: 'Ответь одним словом: привет' }] }], generationConfig: { maxOutputTokens: 30 } };
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    const txt = await res.text();
    console.log(`${model} -> HTTP ${res.status} (${Date.now() - t0}ms) ${txt.slice(0, 120).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`${model} -> EXC (${Date.now() - t0}ms): ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

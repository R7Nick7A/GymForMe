import { get, init } from './db.js';

await init();
const row = await get("SELECT value FROM settings WHERE key = 'gemini_api_key'");
const key = row?.value;
if (!key) {
  console.log('NO_KEY');
  process.exit(1);
}

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`);
const data = await res.json();
if (data.models) {
  for (const m of data.models) {
    const methods = (m.supportedGenerationMethods || []).join(',');
    console.log(`${m.name}  |  ${methods}`);
  }
} else {
  console.log(JSON.stringify(data, null, 2));
}

// Mock-тест ИИ-модуля без реального ключа Gemini.
process.env.GEMINI_API_KEY = 'test-key';

const captured = [];
const mockWorkoutJson = JSON.stringify({
  title: 'Жим лёжа',
  type: 'strength',
  notes: 'тест',
  exercises: [{ name: 'Жим лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] }],
});

// перехватываем fetch, чтобы проверить формат запроса и вернуть mock-ответ
global.fetch = async (url, opts) => {
  captured.push({ url, body: JSON.parse(opts.body) });
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: mockWorkoutJson }] } }],
    }),
  };
};

const ai = await import('./ai.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`);
  if (!cond) failures++;
}

// 1) parseWorkoutText
const parsed = await ai.parseWorkoutText('жим 80 кг 8 раз');
check('parseWorkoutText возвращает объект', parsed && parsed.title === 'Жим лёжа' && parsed.exercises[0].sets.length === 2);

// 2) формат запроса для текста
const req1 = captured[0];
check('текстовый запрос: parts[0].text содержит инструкцию', req1.body.contents[0].parts[0].text.includes('спортивный аналитик'));
check('текстовый запрос: responseMimeType = application/json', req1.body.generationConfig.responseMimeType === 'application/json');
check('текстовый запрос: role = user', req1.body.contents[0].role === 'user');

// 3) analyzeImage
const parsedImg = await ai.analyzeImage('AAAA', 'image/png');
check('analyzeImage возвращает объект', parsedImg && parsedImg.title === 'Жим лёжа');
const req2 = captured[1];
const hasInlineData = req2.body.contents[0].parts.some((p) => p.inline_data && p.inline_data.mime_type === 'image/png' && p.inline_data.data === 'AAAA');
const hasText = req2.body.contents[0].parts.some((p) => typeof p.text === 'string' && p.text.length > 0);
check('запрос с фото: есть inline_data (изображение)', hasInlineData);
check('запрос с фото: есть текстовая инструкция', hasText);

// 4) assistantChat
const reply = await ai.assistantChat(
  [{ role: 'user', content: 'как дела?' }],
  JSON.stringify({ workouts: [], exercises: [] })
);
check('assistantChat возвращает текст', typeof reply === 'string' && reply.length > 0);
const req3 = captured[2];
check('чат: системный промпт в первом part', req3.body.contents[0].parts[0].text.includes('персональный ИИ-тренер'));
check('чат: история передана корректно', req3.body.contents[1].role === 'user' && req3.body.contents[1].parts[0].text === 'как дела?');

// 5) forecastProgress и suggestPlan (JSON-пути)
const fc = await ai.forecastProgress();
check('forecastProgress возвращает текст', typeof fc === 'string' && fc.length > 0);
const plan = await ai.suggestPlan('сила');
check('suggestPlan парсит JSON (markdown-обёртка) ', plan && plan.title === 'Жим лёжа');

console.log(`\nИтог: ${failures === 0 ? 'ВСЕ ПРОВЕРКИ ПРОШЛИ ✅' : failures + ' ошибок ❌'}`);
process.exit(failures === 0 ? 0 : 1);

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json', ...(options.headers || {}) }
      : options.headers || {},
    ...options,
  });
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch (_) {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  health: () => request('/health'),
  workouts: () => request('/workouts'),
  workout: (id) => request(`/workouts/${id}`),
  createWorkout: (data) => request('/workouts', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkout: (id, data) => request(`/workouts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkout: (id) => request(`/workouts/${id}`, { method: 'DELETE' }),
  addExercise: (workoutId, data) => request(`/workouts/${workoutId}/exercises`, { method: 'POST', body: JSON.stringify(data) }),
  deleteExercise: (id) => request(`/exercises/${id}`, { method: 'DELETE' }),
  addSet: (exerciseId, data) => request(`/exercises/${exerciseId}/sets`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSet: (id) => request(`/sets/${id}`, { method: 'DELETE' }),
  uploadMedia: (formData) => request('/media', { method: 'POST', body: formData }),
  stats: () => request('/stats/summary'),
  messages: () => request('/messages'),
  sendMessage: (content) => request('/messages', { method: 'POST', body: JSON.stringify({ content }) }),
  parseText: (text) => request('/ai/parse-text', { method: 'POST', body: JSON.stringify({ text }) }),
  parseImage: (base64, mimeType) => request('/ai/parse-image', { method: 'POST', body: JSON.stringify({ base64, mimeType }) }),
  forecast: () => request('/ai/forecast'),
  createPlan: (goal) => request('/ai/plans', { method: 'POST', body: JSON.stringify({ goal }) }),
  plans: () => request('/plans'),
  deletePlan: (id) => request(`/plans/${id}`, { method: 'DELETE' }),
  settings: () => request('/settings'),
  updateSettings: (values) => request('/settings', { method: 'PUT', body: JSON.stringify(values) }),
};

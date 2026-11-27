const BASE = '/api';
const TOKEN_KEY = 'trainapp_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + path, { ...options, headers });
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch (_) {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  // auth
  register: (username, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  recover: (username, recoveryCode, newPassword) => request('/auth/recover', { method: 'POST', body: JSON.stringify({ username, recoveryCode, newPassword }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // data
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
  deleteMedia: (id) => request(`/media/${id}`, { method: 'DELETE' }),
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
  workoutTypes: () => request('/workout-types'),
  createWorkoutType: (name) => request('/workout-types', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteWorkoutType: (id) => request(`/workout-types/${id}`, { method: 'DELETE' }),
  deleteAccount: () => request('/account', { method: 'DELETE' }),
};

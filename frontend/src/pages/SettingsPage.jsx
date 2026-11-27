import React, { useEffect, useState } from 'react';
import { KeyRound, CheckCircle2, Circle, User, LogOut } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const LEVELS = ['новичок', 'средний', 'продвинутый'];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [configured, setConfigured] = useState(false);
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('средний');
  const [weight, setWeight] = useState('');

  useEffect(() => {
    api.settings()
      .then((s) => {
        setConfigured(s.geminiConfigured);
        const v = s.values || {};
        setName(v.profile_name || '');
        setGoal(v.profile_goal || '');
        setLevel(v.profile_level || 'средний');
        setWeight(v.profile_weight || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    await api.updateSettings({ profile_name: name, profile_goal: goal, profile_level: level, profile_weight: weight });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveKey = async () => {
    if (!key.trim()) return;
    await api.updateSettings({ gemini_api_key: key.trim() });
    setConfigured(true);
    setKey('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Настройки</h1>
        <p className="text-sm text-ios-gray">Профиль и подключение ИИ</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
          <User size={16} className="text-brand-400" /> Профиль
        </h2>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-ios-gray">Имя</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к тебе обращаться"
              className="w-full rounded-xl border border-white/10 bg-ios-surface2 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ios-gray">Цель</span>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Например: сила, выносливость, набор массы"
              className="w-full rounded-xl border border-white/10 bg-ios-surface2 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ios-gray">Уровень</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-ios-surface2 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ios-gray">Вес (кг) — для расчёта калорий</span>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              type="number"
              inputMode="decimal"
              placeholder="Например, 75"
              className="w-full rounded-xl border border-white/10 bg-ios-surface2 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
            />
          </label>
          <button
            onClick={saveProfile}
            className="w-full rounded-xl bg-ios-surface2 py-2.5 text-sm font-semibold text-brand-400"
          >
            {saved ? 'Сохранено ✓' : 'Сохранить профиль'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
          <KeyRound size={16} className="text-brand-400" /> ИИ-помощник (Gemini)
        </h2>

        <div className="mb-3 flex items-center gap-2 text-sm">
          {loading ? (
            <span className="text-ios-gray">Проверяю…</span>
          ) : configured ? (
            <span className="flex items-center gap-1.5 text-brand-400">
              <CheckCircle2 size={16} /> Подключено
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-ios-orange">
              <Circle size={16} /> Не подключено
            </span>
          )}
        </div>

        <p className="mb-2 text-xs leading-relaxed text-ios-gray">
          Бесплатный ключ: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-brand-400 underline">aistudio.google.com/apikey</a>.
          Если не добавлять свой — используется общий ключ приложения (настроенный владельцем).
        </p>

        <div className="flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Вставь ключ (начинается с AIza…)"
            className="flex-1 rounded-xl border border-white/10 bg-ios-surface2 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
          />
          <button
            onClick={saveKey}
            disabled={!key.trim()}
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            {saved ? 'Готово ✓' : 'Сохранить'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
        <p className="mb-3 text-sm text-ios-gray">
          Вы вошли как <b className="text-white/90">{user?.username}</b>
        </p>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 py-2.5 text-sm font-semibold text-rose-400"
        >
          <LogOut size={16} /> Выйти из аккаунта
        </button>
      </section>
    </div>
  );
}

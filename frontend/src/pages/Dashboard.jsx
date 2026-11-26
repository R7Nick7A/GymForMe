import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Flame, TrendingUp, CalendarDays, Dumbbell, ChevronRight, Plus, Settings, Wand2 } from 'lucide-react';
import { api } from '../api.js';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState('');
  const [forecast, setForecast] = useState('');
  const [forecastBusy, setForecastBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.stats(), api.workouts()])
      .then(([s, w]) => {
        setStats(s);
        setWorkouts(w);
      })
      .catch((e) => setError(e.message));
  }, []);

  const loadForecast = async () => {
    setForecastBusy(true);
    try {
      const r = await api.forecast();
      setForecast(r.forecast || '');
    } catch (e) {
      setForecast('Ошибка: ' + e.message);
    } finally {
      setForecastBusy(false);
    }
  };

  if (error) return <div className="p-4 text-rose-400">Ошибка: {error}</div>;
  if (!stats) return <div className="p-4 text-ios-gray">Загрузка…</div>;

  const totalVolume = stats.volumeByDay.reduce((sum, d) => sum + d.volume, 0);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Главная</h1>
          <p className="text-sm text-ios-gray">Мониторинг твоего тренировочного процесса</p>
        </div>
        <Link to="/settings" className="rounded-lg p-2 text-ios-gray hover:bg-white/5">
          <Settings size={20} />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card icon={<Dumbbell className="text-brand-400" size={18} />} label="Тренировок" value={stats.totalWorkouts} />
        <Card icon={<CalendarDays className="text-sky-400" size={18} />} label="За 7 дней" value={stats.last7} />
        <Card icon={<Flame className="text-orange-400" size={18} />} label="За 30 дней" value={stats.last30} />
        <Card icon={<TrendingUp className="text-violet-400" size={18} />} label="Объём, кг" value={totalVolume.toLocaleString('ru-RU')} />
      </div>

      {stats.volumeByDay.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/90">Объём нагрузки по дням</h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.volumeByDay} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e2e8f0' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="volume" stroke="#34d399" strokeWidth={2} fill="url(#vol)" name="Объём" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {stats.exerciseFrequency.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/90">Частые упражнения</h2>
          <ul className="space-y-2">
            {stats.exerciseFrequency.slice(0, 6).map((ex) => (
              <li key={ex.name} className="flex items-center justify-between text-sm">
                <span className="text-[#d1d1d6]">{ex.name}</span>
                <span className="text-ios-gray2">
                  {ex.cnt} подходов{ex.max_weight ? ` · макс ${ex.max_weight} кг` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Анализ и прогноз</h2>
          <button onClick={loadForecast} disabled={forecastBusy} className="flex items-center gap-1 text-xs text-brand-400 disabled:opacity-50">
            <Wand2 size={14} /> {forecastBusy ? 'Анализирую…' : forecast ? 'Обновить' : 'Получить'}
          </button>
        </div>
        {forecast ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ios-gray">{forecast}</p>
        ) : (
          <p className="text-sm text-ios-gray2">ИИ проанализирует твои тренировки и даст прогноз прогресса.</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Последние тренировки</h2>
          <Link to="/workouts" className="flex items-center text-xs text-brand-400">
            все <ChevronRight size={14} />
          </Link>
        </div>
        {workouts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <p className="mb-3 text-sm text-ios-gray">Пока нет тренировок</p>
            <Link to="/new" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-black">
              <Plus size={16} /> Добавить
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {workouts.slice(0, 5).map((w) => (
              <li key={w.id}>
                <Link to={`/workouts/${w.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-ios-surface px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{w.title}</p>
                    <p className="text-xs text-ios-gray2">{w.date} · {w.exercise_count} упр.</p>
                  </div>
                  <ChevronRight size={16} className="text-ios-gray2" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ios-surface p-4">
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
      <div className="text-xs text-ios-gray">{label}</div>
    </div>
  );
}

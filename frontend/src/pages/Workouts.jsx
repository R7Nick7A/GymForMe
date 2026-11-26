import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';

export default function Workouts() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.workouts()
      .then(setWorkouts)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (id) => {
    if (!confirm('Удалить тренировку?')) return;
    await api.deleteWorkout(id);
    load();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Тренировки</h1>
          <p className="text-sm text-ios-gray">{workouts.length} всего</p>
        </div>
        <Link to="/new" className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-black">
          <Plus size={16} /> Новая
        </Link>
      </header>

      {loading ? (
        <p className="text-ios-gray">Загрузка…</p>
      ) : workouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-ios-gray">
          Пока пусто. Добавь первую тренировку.
        </div>
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => (
            <li key={w.id} className="group flex items-center rounded-xl border border-white/10 bg-ios-surface">
              <Link to={`/workouts/${w.id}`} className="flex flex-1 items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{w.title}</p>
                  <p className="text-xs text-ios-gray2">
                    {w.date} · {w.exercise_count} упр. · {w.set_count} подход.
                  </p>
                </div>
                <ChevronRight size={16} className="text-ios-gray2" />
              </Link>
              <button onClick={() => remove(w.id)} className="px-3 text-ios-gray2 hover:text-rose-400">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

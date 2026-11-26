import React, { useEffect, useState } from 'react';
import { CalendarRange, Wand2, Trash2 } from 'lucide-react';
import { api } from '../api.js';

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.plans().then(setPlans).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setError('');
    setBusy(true);
    try {
      await api.createPlan(goal.trim() || null);
      setGoal('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Удалить план?')) return;
    await api.deletePlan(id);
    load();
  };

  const parsePlan = (p) => {
    try {
      return JSON.parse(p.plan_json || '{}');
    } catch (_) {
      return {};
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-white">
          <CalendarRange className="text-brand-400" size={24} /> Планы
        </h1>
        <p className="text-sm text-ios-gray">Рекомендации ИИ на несколько недель</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-white/90">Сгенерировать план</h2>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder="Цель, например: сила, выносливость, набор массы… (можно оставить пустым)"
          className="w-full rounded-xl border border-white/10 bg-ios-surface2 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
        />
        <button
          onClick={generate}
          disabled={busy}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          <Wand2 size={16} /> {busy ? 'Составляю…' : 'Составить план'}
        </button>
      </section>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-ios-gray">
          Пока нет планов. Нажми «Составить план».
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => {
            const plan = parsePlan(p);
            return (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-ios-surface p-4">
                <div className="mb-1 flex items-start justify-between">
                  <h3 className="font-semibold text-white">{plan.title || p.title}</h3>
                  <button onClick={() => remove(p.id)} className="text-ios-gray2 hover:text-rose-400">
                    <Trash2 size={16} />
                  </button>
                </div>
                {plan.duration_weeks && (
                  <p className="mb-1 text-xs text-ios-gray">Длительность: {plan.duration_weeks} нед.</p>
                )}
                {plan.description && <p className="mb-2 text-sm text-ios-gray">{plan.description}</p>}
                {Array.isArray(plan.schedule) && (
                  <div className="space-y-2">
                    {plan.schedule.map((wk, i) => (
                      <div key={i} className="rounded-xl bg-ios-surface2 p-3">
                        <p className="mb-1 text-xs font-semibold text-brand-400">Неделя {wk.week}</p>
                        {Array.isArray(wk.days) &&
                          wk.days.map((d, j) => (
                            <div key={j} className="mb-1 text-xs text-ios-gray">
                              <span className="text-white/90">{d.day}:</span> {d.focus}
                              {Array.isArray(d.exercises) && d.exercises.length > 0 && (
                                <span className="text-ios-gray2"> — {d.exercises.join(', ')}</span>
                              )}
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

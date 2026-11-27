import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api.js';

export default function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [w, setW] = useState(null);
  const [error, setError] = useState('');
  const [newExercise, setNewExercise] = useState('');
  const [newSets, setNewSets] = useState({});

  const load = () => api.workout(id).then(setW).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const addExercise = async () => {
    const name = newExercise.trim();
    if (!name) return;
    setNewExercise('');
    await api.addExercise(id, { name });
    load();
  };

  const addSet = async (exerciseId) => {
    const s = newSets[exerciseId] || {};
    if ((s.weight === undefined || s.weight === '') && (s.reps === undefined || s.reps === '')) return;
    await api.addSet(exerciseId, {
      weight: s.weight === '' || s.weight === undefined ? null : Number(s.weight),
      reps: s.reps === '' || s.reps === undefined ? null : Number(s.reps),
    });
    setNewSets((m) => ({ ...m, [exerciseId]: { weight: '', reps: '' } }));
    load();
  };

  const delExercise = async (exerciseId) => {
    if (!confirm('Удалить упражнение со всеми подходами?')) return;
    await api.deleteExercise(exerciseId);
    load();
  };

  const delSet = async (setId) => {
    await api.deleteSet(setId);
    load();
  };

  const setField = (exerciseId, field, val) => {
    setNewSets((m) => ({ ...m, [exerciseId]: { ...(m[exerciseId] || {}), [field]: val } }));
  };

  if (error) return <p className="text-rose-400">Ошибка: {error}</p>;
  if (!w) return <p className="text-ios-gray">Загрузка…</p>;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg p-1 text-ios-gray hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{w.title}</h1>
          <p className="text-xs text-ios-gray">{w.date}{w.type ? ` · ${w.type}` : ''}</p>
        </div>
      </header>

      {w.notes && <p className="whitespace-pre-wrap text-sm text-ios-gray">{w.notes}</p>}

      <div className="space-y-3">
        {w.exercises.map((ex) => (
          <div key={ex.id} className="rounded-2xl border border-white/10 bg-ios-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-white">{ex.name}</h2>
              <button onClick={() => delExercise(ex.id)} className="text-ios-gray2 hover:text-rose-400">
                <Trash2 size={16} />
              </button>
            </div>

            {ex.sets.length > 0 && (
              <div className="mb-3 divide-y divide-white/5">
                <div className="flex pb-1 text-xs text-ios-gray2">
                  <span className="w-12">Подход</span>
                  <span className="w-16">Вес</span>
                  <span>Повт.</span>
                </div>
                {ex.sets.map((s) => (
                  <div key={s.id} className="flex items-center py-1.5 text-sm text-white/90">
                    <span className="w-12 text-ios-gray">#{s.set_number}</span>
                    <span className="w-16">{s.weight != null ? `${s.weight} кг` : '—'}</span>
                    <span className="flex-1">{s.reps != null ? s.reps : '—'}</span>
                    <button onClick={() => delSet(s.id)} className="rounded p-1 text-ios-gray2 hover:text-rose-400" title="Убрать подход">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                value={newSets[ex.id]?.weight ?? ''}
                onChange={(e) => setField(ex.id, 'weight', e.target.value)}
                type="number"
                inputMode="decimal"
                placeholder="кг"
                className="w-16 rounded-lg border border-white/10 bg-ios-surface2 px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
              />
              <input
                value={newSets[ex.id]?.reps ?? ''}
                onChange={(e) => setField(ex.id, 'reps', e.target.value)}
                type="number"
                inputMode="numeric"
                placeholder="повт."
                className="w-16 rounded-lg border border-white/10 bg-ios-surface2 px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
              />
              <button onClick={() => addSet(ex.id)} className="flex items-center gap-1 text-xs text-brand-400">
                <Plus size={14} /> Подход
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={newExercise}
          onChange={(e) => setNewExercise(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addExercise(); }}
          placeholder="Название нового упражнения"
          className="flex-1 rounded-xl border border-white/10 bg-ios-surface px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
        />
        <button onClick={addExercise} className="rounded-xl bg-brand-500 px-3 py-2.5 text-sm font-semibold text-black">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

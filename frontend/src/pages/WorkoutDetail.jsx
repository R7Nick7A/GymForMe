import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Save, X, Trash2, ChevronDown, Calendar } from 'lucide-react';
import { api } from '../api.js';
import { TYPE_OPTIONS, typeLabel } from '../labels.js';

export default function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [w, setW] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [customTypes, setCustomTypes] = useState([]);

  const load = () => api.workout(id).then(setW).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);
  useEffect(() => { api.workoutTypes().then(setCustomTypes).catch(() => {}); }, []);

  const startEdit = () => {
    setForm({
      title: w.title,
      date: w.date,
      type: w.type || 'strength',
      notes: w.notes || '',
      exercises: w.exercises.map((ex) => ({
        key: ex.id,
        name: ex.name,
        sets: ex.sets.map((s) => ({ key: s.id, weight: s.weight ?? '', reps: s.reps ?? '' })),
      })),
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(null);
  };

  // --- хелперы редактирования формы ---
  const setField = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const typeOptions = [
    ...TYPE_OPTIONS,
    ...customTypes.map((t) => ({ value: t.name, label: t.name })),
  ];
  const onTypeChange = async (val) => {
    if (val === '__add__') {
      const name = (window.prompt('Название нового типа тренировки') || '').trim();
      if (!name) return;
      try {
        const t = await api.createWorkoutType(name);
        setCustomTypes((prev) => [...prev, t]);
        setField('type', t.name);
      } catch (e) {
        setError(e.message);
      }
      return;
    }
    setField('type', val);
  };
  const addExercise = () => setForm((f) => ({ ...f, exercises: [...f.exercises, { key: Date.now(), name: '', sets: [{ key: Date.now() + 1, weight: '', reps: '' }] }] }));
  const removeExercise = (ek) => setForm((f) => ({ ...f, exercises: f.exercises.filter((e) => e.key !== ek) }));
  const updateExercise = (ek, field, val) => setForm((f) => ({ ...f, exercises: f.exercises.map((e) => (e.key === ek ? { ...e, [field]: val } : e)) }));
  const addSet = (ek) => setForm((f) => ({ ...f, exercises: f.exercises.map((e) => (e.key === ek ? { ...e, sets: [...e.sets, { key: Date.now(), weight: '', reps: '' }] } : e)) }));
  const removeSet = (ek, sk) => setForm((f) => ({ ...f, exercises: f.exercises.map((e) => (e.key === ek ? { ...e, sets: e.sets.filter((s) => s.key !== sk) } : e)) }));
  const updateSet = (ek, sk, field, val) => setForm((f) => ({ ...f, exercises: f.exercises.map((e) => (e.key === ek ? { ...e, sets: e.sets.map((s) => (s.key === sk ? { ...s, [field]: val } : s)) } : e)) }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        date: form.date,
        type: form.type,
        notes: form.notes.trim() || null,
        exercises: form.exercises
          .filter((e) => e.name.trim())
          .map((e) => ({
            name: e.name.trim(),
            sets: e.sets
              .filter((s) => s.weight !== '' || s.reps !== '')
              .map((s, i) => ({
                set_number: i + 1,
                weight: s.weight === '' ? null : Number(s.weight),
                reps: s.reps === '' ? null : Number(s.reps),
              })),
          })),
      };
      await api.updateWorkout(w.id, payload);
      setEditing(false);
      setForm(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const tonnageOf = (sets) => sets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
  const totalTonnage = w ? w.exercises.reduce((sum, ex) => sum + tonnageOf(ex.sets), 0) : 0;

  if (error && !w) return <p className="text-rose-400">Ошибка: {error}</p>;
  if (!w) return <p className="text-ios-gray">Загрузка…</p>;

  // ================= РЕЖИМ РЕДАКТИРОВАНИЯ =================
  if (editing && form) {
    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={cancelEdit} className="rounded-lg p-1 text-ios-gray hover:bg-white/5">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-white">Редактирование</h1>
          </div>
        </header>

        <label className="block">
          <span className="mb-1 block text-xs text-ios-gray">Название</span>
          <input value={form.title} onChange={(e) => setField('title', e.target.value)} className="w-full rounded-xl border border-white/10 bg-ios-surface px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="min-w-0">
            <span className="mb-1 block text-xs text-ios-gray">Дата</span>
            <div className="relative">
              <input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} className="block w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-white/10 bg-ios-surface px-3 py-2.5 pr-9 text-sm text-white outline-none focus:border-brand-500" />
              <Calendar size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-400" />
            </div>
          </label>
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-ios-gray">Тип</span>
            <div className="relative">
              <select value={form.type} onChange={(e) => onTypeChange(e.target.value)} className="block w-full appearance-none rounded-xl border border-white/10 bg-ios-surface px-3 py-2.5 pr-9 text-sm text-white outline-none focus:border-brand-500">
                {typeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                <option value="__add__">➕ Добавить свой тип…</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-400" />
            </div>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-ios-gray">Заметки</span>
          <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-ios-surface px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500" />
        </label>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">Упражнения</h2>
            <button onClick={addExercise} className="flex items-center gap-1 text-xs text-brand-400"><Plus size={14} /> Упражнение</button>
          </div>

          {form.exercises.map((ex) => (
            <div key={ex.key} className="rounded-xl border border-white/10 bg-ios-surface p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <input value={ex.name} onChange={(e) => updateExercise(ex.key, 'name', e.target.value)} placeholder="Название упражнения" className="w-full rounded-lg border border-white/10 bg-ios-surface2 px-3 py-2 pr-8 text-sm text-white outline-none focus:border-brand-500" />
                  {ex.name && (
                    <button onClick={() => updateExercise(ex.key, 'name', '')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ios-gray2 hover:text-white" title="Очистить">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button onClick={() => removeExercise(ex.key)} className="shrink-0 text-ios-gray2 hover:text-rose-400" title="Удалить упражнение"><Trash2 size={16} /></button>
              </div>
              <div className="space-y-1.5">
                {ex.sets.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2 text-xs text-ios-gray">
                    <span className="w-4">#{i + 1}</span>
                    <input value={s.weight} onChange={(e) => updateSet(ex.key, s.key, 'weight', e.target.value)} type="number" inputMode="decimal" placeholder="кг" className="w-16 rounded-lg border border-white/10 bg-ios-surface2 px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500" />
                    <input value={s.reps} onChange={(e) => updateSet(ex.key, s.key, 'reps', e.target.value)} type="number" inputMode="numeric" placeholder="повт." className="w-16 rounded-lg border border-white/10 bg-ios-surface2 px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500" />
                    <button onClick={() => removeSet(ex.key, s.key)} className="ml-auto rounded p-1 text-ios-gray2 hover:text-rose-400" title="Убрать подход"><X size={15} /></button>
                  </div>
                ))}
                <button onClick={() => addSet(ex.key)} className="mt-1 text-xs text-brand-400">+ подход</button>
              </div>
            </div>
          ))}
        </section>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="flex gap-2">
          <button onClick={cancelEdit} className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-semibold text-white/80">Отмена</button>
          <button onClick={save} disabled={saving || !form.title.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-black disabled:opacity-40">
            <Save size={16} /> {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </div>
    );
  }

  // ================= РЕЖИМ ПРОСМОТРА =================
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg p-1 text-ios-gray hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight text-white">{w.title}</h1>
          <p className="text-xs text-ios-gray">{w.date}{w.type ? ` · ${typeLabel(w.type)}` : ''}</p>
        </div>
        <button onClick={startEdit} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ios-surface2 px-3 py-2 text-xs font-semibold text-brand-400">
          <Pencil size={14} /> Изменить
        </button>
      </header>

      {w.notes && <p className="whitespace-pre-wrap text-sm text-ios-gray">{w.notes}</p>}

      {totalTonnage > 0 && (
        <details className="rounded-2xl border border-brand-500/30 bg-ios-surface p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-brand-400">
            🏋️ Тоннаж: {totalTonnage.toLocaleString('ru-RU')} кг · нажми, чтобы увидеть расчёт
          </summary>
          <p className="mt-2 text-xs text-ios-gray2">Тоннаж = Σ (вес × повторения) по всем подходам.</p>
          <ul className="mt-2 space-y-2">
            {w.exercises.map((ex) => {
              const t = tonnageOf(ex.sets);
              if (!t) return null;
              return (
                <li key={ex.id} className="text-sm">
                  <span className="text-white/90">{ex.name}</span>
                  <span className="ml-1 text-ios-gray2">
                    {' '}({ex.sets.map((s) => `${s.weight ?? 0}×${s.reps ?? 0}`).join(' + ')}) = <b className="text-brand-400">{t} кг</b>
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <div className="space-y-3">
        {w.exercises.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-ios-gray2">Нет упражнений. Нажми «Изменить», чтобы добавить.</p>
        )}
        {w.exercises.map((ex) => (
          <div key={ex.id} className="rounded-2xl border border-white/10 bg-ios-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-white">{ex.name}</h2>
              <span className="text-xs text-ios-gray2">{tonnageOf(ex.sets)} кг</span>
            </div>
            {ex.sets.length > 0 ? (
              <div className="divide-y divide-white/5">
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
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ios-gray2">Нет подходов</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

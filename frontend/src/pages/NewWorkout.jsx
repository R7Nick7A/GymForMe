import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ImagePlus, Save, FileText, Wand2, X } from 'lucide-react';
import { api } from '../api.js';

const TYPES = ['strength', 'cardio', 'crossfit', 'stretching', 'other'];

export default function NewWorkout() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState('strength');
  const [notes, setNotes] = useState('');
  const [textDump, setTextDump] = useState('');
  const [photos, setPhotos] = useState([]);
  const [exercises, setExercises] = useState([{ key: 1, name: '', sets: [{ key: 1, weight: '', reps: '' }] }]);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState('');
  const [error, setError] = useState('');

  const addExercise = () => {
    setExercises((e) => [...e, { key: Date.now(), name: '', sets: [{ key: Date.now() + 1, weight: '', reps: '' }] }]);
  };
  const addSet = (exKey) => {
    setExercises((exs) =>
      exs.map((ex) => (ex.key === exKey ? { ...ex, sets: [...ex.sets, { key: Date.now(), weight: '', reps: '' }] } : ex))
    );
  };
  const updateExercise = (exKey, field, val) => {
    setExercises((exs) => exs.map((ex) => (ex.key === exKey ? { ...ex, [field]: val } : ex)));
  };
  const updateSet = (exKey, setKey, field, val) => {
    setExercises((exs) =>
      exs.map((ex) =>
        ex.key === exKey
          ? { ...ex, sets: ex.sets.map((s) => (s.key === setKey ? { ...s, [field]: val } : s)) }
          : ex
      )
    );
  };
  const removeExercise = (exKey) => setExercises((exs) => exs.filter((ex) => ex.key !== exKey));
  const removeSet = (exKey, setKey) =>
    setExercises((exs) =>
      exs.map((ex) => (ex.key === exKey ? { ...ex, sets: ex.sets.filter((s) => s.key !== setKey) } : ex))
    );

  const onPhotos = (e) => setPhotos((prev) => [...prev, ...Array.from(e.target.files || [])]);
  const removePhoto = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = r.result;
        const mime = dataUrl.match(/^data:(.*?);/)?.[1] || file.type;
        resolve({ base64: dataUrl.split(',')[1], mimeType: mime });
      };
      r.onerror = () => reject(new Error('Не удалось прочитать файл'));
      r.readAsDataURL(file);
    });

  const applyParsed = (data) => {
    if (data?.title) setTitle(data.title);
    if (data?.type && TYPES.includes(data.type)) setType(data.type);
    if (data?.notes) setNotes(data.notes);
    const exs = (data?.exercises || [])
      .filter((ex) => ex?.name)
      .map((ex, i) => ({
        key: Date.now() + i,
        name: ex.name,
        sets: (ex.sets || []).map((s, j) => ({
          key: Date.now() + i * 100 + j,
          weight: s.weight != null ? String(s.weight) : '',
          reps: s.reps != null ? String(s.reps) : '',
        })),
      }));
    if (exs.length) setExercises(exs);
  };

  const parseText = async () => {
    if (!textDump.trim()) return setError('Сначала вставь текст тренировки');
    setError('');
    setParsing('text');
    try {
      applyParsed(await api.parseText(textDump));
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing('');
    }
  };

  const parsePhoto = async () => {
    if (!photos.length) return setError('Сначала выбери фото или скриншот');
    setError('');
    setParsing('photo');
    try {
      const { base64, mimeType } = await fileToBase64(photos[0]);
      applyParsed(await api.parseImage(base64, mimeType));
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing('');
    }
  };

  const save = async () => {
    setError('');
    if (!title.trim()) return setError('Введи название тренировки');
    setSaving(true);
    try {
      const payloadExercises = exercises
        .filter((ex) => ex.name.trim())
        .map((ex) => ({
          name: ex.name.trim(),
          sets: ex.sets
            .filter((s) => s.weight !== '' || s.reps !== '')
            .map((s, i) => ({
              set_number: i + 1,
              weight: s.weight === '' ? null : Number(s.weight),
              reps: s.reps === '' ? null : Number(s.reps),
            })),
        }));

      const body = {
        title: title.trim(),
        date,
        type,
        source: photos.length > 0 || textDump.trim() ? 'import' : 'manual',
        notes: [notes.trim(), textDump.trim()].filter(Boolean).join('\n') || null,
        exercises: payloadExercises,
      };

      const created = await api.createWorkout(body);

      for (const f of photos) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('workout_id', String(created.id));
        fd.append('kind', 'photo');
        await api.uploadMedia(fd);
      }

      navigate(`/workouts/${created.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Новая тренировка</h1>
        <p className="text-sm text-ios-gray">Добавь вручную, текстом или фото</p>
      </header>

      <label className="block">
        <span className="mb-1 block text-xs text-ios-gray">Название</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Грудь и трицепс"
          className="w-full rounded-xl border border-white/10 bg-ios-surface px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0">
          <span className="mb-1 block text-xs text-ios-gray">Дата</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="block w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-white/10 bg-ios-surface px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-xs text-ios-gray">Тип</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="block w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-ios-surface px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
          <FileText size={16} className="text-brand-400" /> Текст тренировки (из заметок)
        </h2>
        <textarea
          value={textDump}
          onChange={(e) => setTextDump(e.target.value)}
          rows={3}
          placeholder="Вставь сюда текст из заметок — ИИ разберёт его в структуру"
          className="w-full rounded-xl border border-white/10 bg-ios-surface2 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
        />
        <button onClick={parseText} disabled={!!parsing} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-400 disabled:opacity-50">
          <Wand2 size={14} /> {parsing === 'text' ? 'Создаю…' : 'Создать тренировку по тексту'}
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <ImagePlus size={16} className="text-brand-400" /> Фото / скриншот
          </h2>
          {photos.length > 0 && <span className="text-xs text-ios-gray">{photos.length} фото</span>}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-ios-surface2 px-3 py-2 text-xs font-medium text-brand-400">
          + Добавить фото
          <input type="file" accept="image/*" multiple onChange={onPhotos} className="hidden" />
        </label>

        {photos.length > 0 && (
          <>
            <ul className="mt-2 space-y-1.5">
              {photos.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-ios-surface2 px-2.5 py-1.5 text-xs text-ios-gray">
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => removePhoto(i)} className="ml-2 shrink-0 text-ios-gray2 hover:text-rose-400" title="Убрать это фото">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={parsePhoto} disabled={!!parsing} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-400 disabled:opacity-50">
              <Wand2 size={14} /> {parsing === 'photo' ? 'Создаю…' : 'Создать тренировку по фото'}
            </button>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Упражнения</h2>
          <button onClick={addExercise} className="flex items-center gap-1 text-xs text-brand-400">
            <Plus size={14} /> Упражнение
          </button>
        </div>

        {exercises.map((ex) => (
          <div key={ex.key} className="rounded-xl border border-white/10 bg-ios-surface p-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  value={ex.name}
                  onChange={(e) => updateExercise(ex.key, 'name', e.target.value)}
                  placeholder="Название упражнения"
                  className="w-full rounded-lg border border-white/10 bg-ios-surface2 px-3 py-2 pr-8 text-sm text-white outline-none focus:border-brand-500"
                />
                {ex.name && (
                  <button
                    onClick={() => updateExercise(ex.key, 'name', '')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ios-gray2 hover:text-white"
                    title="Очистить название"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button onClick={() => removeExercise(ex.key)} className="shrink-0 text-ios-gray2 hover:text-rose-400" title="Удалить упражнение">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="space-y-1.5">
              {ex.sets.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 text-xs text-ios-gray">
                  <span className="w-4">#{i + 1}</span>
                  <input
                    value={s.weight}
                    onChange={(e) => updateSet(ex.key, s.key, 'weight', e.target.value)}
                    type="number"
                    inputMode="decimal"
                    placeholder="кг"
                    className="w-16 rounded-lg border border-white/10 bg-ios-surface2 px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                  />
                  <input
                    value={s.reps}
                    onChange={(e) => updateSet(ex.key, s.key, 'reps', e.target.value)}
                    type="number"
                    inputMode="numeric"
                    placeholder="повт."
                    className="w-16 rounded-lg border border-white/10 bg-ios-surface2 px-2 py-1.5 text-sm text-white outline-none focus:border-brand-500"
                  />
                  <button onClick={() => removeSet(ex.key, s.key)} className="ml-auto rounded p-1 text-ios-gray2 hover:text-rose-400" title="Убрать подход">
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button onClick={() => addSet(ex.key)} className="mt-1 text-xs text-brand-400">
                + подход
              </button>
            </div>
          </div>
        ))}
      </section>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        <Save size={16} /> {saving ? 'Сохраняю…' : 'Сохранить тренировку'}
      </button>
    </div>
  );
}

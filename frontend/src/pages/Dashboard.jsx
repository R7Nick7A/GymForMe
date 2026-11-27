import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Flame, TrendingUp, Dumbbell, ChevronRight, Plus, Settings, Wand2, X, Activity, CalendarDays, ChevronLeft, ChevronDown } from 'lucide-react';
import { api } from '../api.js';
import { typeLabel } from '../labels.js';

const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState('');
  const [forecast, setForecast] = useState('');
  const [forecastBusy, setForecastBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(() => localStorage.getItem('trainapp_help_hidden') !== '1');
  const [modal, setModal] = useState(null); // 'calories' | 'volume' | 'exercise'

  // прогресс по упражнению
  const [exercises, setExercises] = useState([]);
  const [exercise, setExercise] = useState('');
  const [exData, setExData] = useState([]);
  const [period, setPeriod] = useState('30d'); // '30d' | 'custom'
  const [customMode, setCustomMode] = useState('days'); // 'days' | 'workouts'
  const [dayFrom, setDayFrom] = useState('');
  const [dayTo, setDayTo] = useState('');
  const [woFrom, setWoFrom] = useState('');
  const [woTo, setWoTo] = useState('');
  const [calMonth, setCalMonth] = useState(new Date());

  useEffect(() => {
    Promise.all([api.stats(), api.workouts()])
      .then(([s, w]) => { setStats(s); setWorkouts(w); })
      .catch((e) => setError(e.message));
    api.exercises().then((list) => { setExercises(list); if (list[0]) setExercise(list[0].name); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!exercise) return;
    api.exerciseData(exercise).then(setExData).catch(() => setExData([]));
  }, [exercise]);

  const hideHelp = () => { localStorage.setItem('trainapp_help_hidden', '1'); setShowHelp(false); };
  const loadForecast = async () => {
    setForecastBusy(true);
    try { setForecast((await api.forecast()).forecast || ''); }
    catch (e) { setForecast('Ошибка: ' + e.message); }
    finally { setForecastBusy(false); }
  };

  const todayStr = fmtDate(new Date());
  const d30 = new Date(); d30.setDate(d30.getDate() - 30); const d30Str = fmtDate(d30);

  // период
  const from = period === '30d' ? d30Str : customMode === 'days' ? (dayFrom || d30Str) : (woFrom || d30Str);
  const to = period === '30d' ? todayStr : customMode === 'days' ? (dayTo || todayStr) : (woTo || todayStr);

  if (error) return <div className="p-4 text-rose-400">Ошибка: {error}</div>;
  if (!stats) return <div className="p-4 text-ios-gray">Загрузка…</div>;

  const lastDate = workouts.reduce((m, w) => (w.date > m ? w.date : m), '');
  const daysAgo = lastDate ? Math.floor((new Date(todayStr) - new Date(lastDate)) / 86400000) : null;
  const lastLabel = daysAgo == null ? '—' : daysAgo === 0 ? 'сегодня' : `${daysAgo} дн.`;

  const vp = stats.volumeProgress || { current: 0, previous: 0, changePct: 0, breakdown: [] };
  const exFiltered = exData.filter((d) => d.date >= from && d.date <= to);
  const exTotal = exFiltered.reduce((s, d) => s + d.volume, 0);
  const exFirst = exFiltered[0]?.volume || 0;
  const exLast = exFiltered[exFiltered.length - 1]?.volume || 0;
  const exChange = exFirst > 0 ? Math.round(((exLast - exFirst) / exFirst) * 100) : 0;
  const workoutDates = workouts.map((w) => w.date);

  const pickDay = (ds) => {
    if (!dayFrom || (dayFrom && dayTo)) { setDayFrom(ds); setDayTo(''); }
    else if (ds >= dayFrom) setDayTo(ds);
    else { setDayTo(dayFrom); setDayFrom(ds); }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Главная</h1>
          <p className="text-sm text-ios-gray">Мониторинг твоего тренировочного процесса</p>
        </div>
        <Link to="/settings" className="rounded-lg p-2 text-ios-gray hover:bg-white/5">
          <Settings size={20} />
        </Link>
      </header>

      {showHelp && (
        <section className="rounded-2xl border border-brand-500/30 bg-ios-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-400">📱 Как пользоваться</h2>
            <button onClick={hideHelp} className="rounded p-1 text-ios-gray2 hover:text-white" title="Скрыть"><X size={16} /></button>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ios-gray">
            <li>Нажми <b className="text-white/90">«+ Новая»</b> (внизу) — запиши тренировку. Можно руками, текстом из заметок или фото.</li>
            <li>ИИ сам разберёт фото или текст в упражнения и подходы — проверь и нажми «Сохранить».</li>
            <li><b className="text-white/90">«Тренировки»</b> — вся история.</li>
            <li><b className="text-white/90">«Помощник»</b> — спроси ИИ о прогрессе.</li>
            <li><b className="text-white/90">«Планы»</b> — попроси план на несколько недель.</li>
          </ol>
          <p className="mt-2 text-xs text-ios-gray2">🔒 Твои данные видишь только ты.</p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card icon={<Dumbbell className="text-brand-400" size={18} />} label="Тренировок" value={stats.totalWorkouts} />
        <Card icon={<CalendarDays className="text-sky-400" size={18} />} label="Последняя тренировка" value={lastLabel} />
        <Card
          icon={<Activity className="text-sky-400" size={18} />}
          label="Калории, ккал"
          value={(stats.calories || 0).toLocaleString('ru-RU')}
          onClick={() => setModal('calories')}
          hint="нажми → расчёт"
        />
        <Card
          icon={<TrendingUp className={vp.changePct >= 0 ? 'text-brand-400' : 'text-rose-400'} size={18} />}
          label="Прогресс объёма"
          value={`${vp.changePct >= 0 ? '+' : ''}${vp.changePct}%`}
          onClick={() => setModal('volume')}
          hint="нажми → расчёт"
        />
      </div>

      {stats.workoutsByWeek.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
          <h2 className="mb-1 text-sm font-semibold text-white/90">Тренировки по неделям</h2>
          <p className="mb-3 text-[11px] text-ios-gray2">Количество тренировок в неделю — видно просадки.</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.workoutsByWeek} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(w) => w.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e2e8f0' }}
                  labelFormatter={(w) => `Неделя с ${w}`}
                />
                <Bar dataKey="count" fill="#34C759" radius={[4, 4, 0, 0]} name="Тренировок" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-ios-surface p-4">
        <div>
          <h2 className="text-sm font-semibold text-white/90">Прогресс по упражнению</h2>
          <p className="text-[11px] text-ios-gray2">Выбери упражнение и период. Нажми на результат → покажет разбивку.</p>
        </div>

        {exercises.length === 0 ? (
          <p className="text-sm text-ios-gray2">Пока нет упражнений — добавь тренировку.</p>
        ) : (
          <>
            <div className="relative">
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="block w-full appearance-none rounded-xl border border-white/10 bg-ios-surface2 px-3 py-2.5 pr-9 text-sm text-white outline-none focus:border-brand-500"
              >
                {exercises.map((e) => <option key={e.name} value={e.name}>{e.name} ({e.cnt})</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-400" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPeriod('30d')} className={`rounded-xl py-2 text-xs font-semibold ${period === '30d' ? 'bg-brand-500 text-black' : 'bg-ios-surface2 text-white/80'}`}>Последние 30 дней</button>
              <button onClick={() => setPeriod('custom')} className={`rounded-xl py-2 text-xs font-semibold ${period === 'custom' ? 'bg-brand-500 text-black' : 'bg-ios-surface2 text-white/80'}`}>Свой период</button>
            </div>

            {period === 'custom' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setCustomMode('days')} className={`rounded-xl py-2 text-xs font-semibold ${customMode === 'days' ? 'bg-ios-surface2 text-brand-400' : 'text-ios-gray'}`}>По дням</button>
                  <button onClick={() => setCustomMode('workouts')} className={`rounded-xl py-2 text-xs font-semibold ${customMode === 'workouts' ? 'bg-ios-surface2 text-brand-400' : 'text-ios-gray'}`}>По тренировкам</button>
                </div>

                {customMode === 'days' ? (
                  <MiniCalendar month={calMonth} setMonth={setCalMonth} workoutDates={workoutDates} from={dayFrom} to={dayTo} onPick={pickDay} />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-ios-gray">С тренировки</span>
                      <select value={woFrom} onChange={(e) => setWoFrom(e.target.value)} className="block w-full appearance-none rounded-lg border border-white/10 bg-ios-surface2 px-2 py-2 text-xs text-white outline-none">
                        <option value="">—</option>
                        {workouts.map((w) => <option key={w.id} value={w.date}>{w.date} · {w.title}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-ios-gray">По тренировку</span>
                      <select value={woTo} onChange={(e) => setWoTo(e.target.value)} className="block w-full appearance-none rounded-lg border border-white/10 bg-ios-surface2 px-2 py-2 text-xs text-white outline-none">
                        <option value="">—</option>
                        {workouts.map((w) => <option key={w.id} value={w.date}>{w.date} · {w.title}</option>)}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setModal('exercise')}
              className="w-full rounded-xl bg-ios-surface2 p-3 text-left active:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-ios-gray">{from} — {to}</span>
                <span className="text-[10px] text-brand-400">нажми → разбивка</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">{exTotal.toLocaleString('ru-RU')} кг</span>
                {exFiltered.length > 1 && (
                  <span className={`text-sm font-semibold ${exChange >= 0 ? 'text-brand-400' : 'text-rose-400'}`}>
                    {exChange >= 0 ? '+' : ''}{exChange}%
                  </span>
                )}
              </div>
              <div className="text-[11px] text-ios-gray2">{exFiltered.length} тренировок с этим упражнением</div>
            </button>
          </>
        )}
      </section>

      {stats.exerciseFrequency.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-ios-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/90">Частые упражнения</h2>
          <ul className="space-y-2">
            {stats.exerciseFrequency.slice(0, 6).map((ex) => (
              <li key={ex.name} className="flex items-center justify-between text-sm">
                <span className="text-[#d1d1d6]">{ex.name}</span>
                <span className="text-ios-gray2">{ex.cnt} подходов{ex.max_weight ? ` · макс ${ex.max_weight} кг` : ''}</span>
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
          <p className="text-sm text-ios-gray2">ИИ проанализирует тренировки и даст прогноз. Нажми «Получить».</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Последние тренировки</h2>
          <Link to="/workouts" className="flex items-center text-xs text-brand-400">все <ChevronRight size={14} /></Link>
        </div>
        {workouts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <p className="mb-3 text-sm text-ios-gray">Пока нет тренировок</p>
            <Link to="/new" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-black"><Plus size={16} /> Добавить</Link>
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

      {modal === 'calories' && (
        <Modal title="Как считаются калории" onClose={() => setModal(null)}>
          <div className="mb-3 space-y-1.5 text-xs text-ios-gray2">
            <p><b className="text-white/80">MET</b> — метаболический эквивалент: во сколько раз активность «тяжелее» покоя (1 MET ≈ 1 ккал на кг в час).</p>
            <p>Формула одна для всех: <b className="text-white/80">ккал = MET × 3.5 × вес(кг) ÷ 200 × минуты</b>.</p>
            <p>Но MET разный по типу: силовая — {stats.metByType?.strength}, кардио — {stats.metByType?.cardio}, кроссфит — {stats.metByType?.crossfit}, растяжка — {stats.metByType?.stretching}, другое — {stats.metByType?.other}.</p>
            <p>Вес: <b className="text-white/80">{stats.weightKg} кг</b> (меняется в Настройках).</p>
            <p>Минуты — оценка: <b className="text-white/80">подходов × 2</b> (минимум 10).</p>
          </div>
          {(stats.caloriesBreakdown || []).length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs text-ios-gray2">Разбивка по тренировкам:</p>
              <ul className="space-y-1 text-xs">
                {stats.caloriesBreakdown.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2 text-ios-gray">
                    <span className="truncate">{c.date} · {typeLabel(c.type)}</span>
                    <span className="shrink-0 text-right text-white/90">
                      {c.kcal} ккал
                      <span className="block text-[10px] text-ios-gray2">MET {c.met} × {c.minutes} мин · {c.sets} подх.</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-white">Итого: <b className="text-brand-400">{stats.calories} ккал</b></p>
        </Modal>
      )}

      {modal === 'volume' && (
        <Modal title="Как считается прогресс объёма" onClose={() => setModal(null)}>
          <p className="mb-2 text-xs text-ios-gray2">Объём = Σ(вес × повторения). Сравниваем последние 30 дней ({vp.from} — {vp.to}) с предыдущими 30.</p>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-ios-gray">Сейчас ({vp.from}—{vp.to})</span>
            <b className="text-white">{vp.current.toLocaleString('ru-RU')} кг</b>
          </div>
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-ios-gray">Предыдущие 30 дней</span>
            <b className="text-white">{vp.previous.toLocaleString('ru-RU')} кг</b>
          </div>
          <p className={`mb-3 text-sm font-semibold ${vp.changePct >= 0 ? 'text-brand-400' : 'text-rose-400'}`}>
            {vp.changePct >= 0 ? 'Рост' : 'Падение'}: {vp.changePct >= 0 ? '+' : ''}{vp.changePct}%
          </p>
          {(vp.breakdown || []).length > 0 && (
            <div>
              <p className="mb-1 text-xs text-ios-gray2">Разбивка по тренировкам (последние 30 дней):</p>
              <ul className="space-y-1 text-sm">
                {vp.breakdown.map((b) => (
                  <li key={b.id} className="flex justify-between text-ios-gray">
                    <span>{b.date} · {b.title}</span>
                    <span className="text-white/90">{b.volume.toLocaleString('ru-RU')} кг</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}

      {modal === 'exercise' && (
        <Modal title={`Прогресс: ${exercise}`} onClose={() => setModal(null)}>
          <p className="mb-2 text-xs text-ios-gray2">Период: {from} — {to}. Объём упражнения = Σ(вес × повторения) по его подходам.</p>
          <p className="mb-3 text-sm text-white">Всего: <b className="text-brand-400">{exTotal.toLocaleString('ru-RU')} кг</b></p>
          {exFiltered.length === 0 ? (
            <p className="text-sm text-ios-gray2">Нет тренировок с этим упражнением за период.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {exFiltered.map((d) => (
                <li key={d.workout_id} className="flex justify-between text-ios-gray">
                  <span>{d.date}</span>
                  <span className="text-white/90">{d.volume.toLocaleString('ru-RU')} кг <span className="text-ios-gray2">({d.sets.map((s) => `${s.weight ?? 0}×${s.reps ?? 0}`).join(' + ')})</span></span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}

function Card({ icon, label, value, onClick, hint }) {
  const cls = `rounded-2xl border border-white/10 bg-ios-surface p-4 text-left ${onClick ? 'active:bg-white/5' : ''}`;
  const inner = (
    <>
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
      <div className="text-xs text-ios-gray">{label}</div>
      {hint && <div className="mt-0.5 text-[10px] text-brand-400">{hint}</div>}
    </>
  );
  return onClick ? <button onClick={onClick} className={cls}>{inner}</button> : <div className={cls}>{inner}</div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-ios-surface p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-ios-gray hover:text-white"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MiniCalendar({ month, setMonth, workoutDates, from, to, onPick }) {
  const set = new Set(workoutDates);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startDay = (first.getDay() + 6) % 7; // Пн = 0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const fmt = (d) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const title = month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-xl bg-ios-surface2 p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded p-1 text-ios-gray hover:text-white"><ChevronLeft size={16} /></button>
        <span className="text-xs capitalize text-white/90">{title}</span>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded p-1 text-ios-gray hover:text-white"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => <div key={d} className="text-center text-[10px] text-ios-gray2">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = fmt(d);
          const hasWorkout = set.has(ds);
          const isEdge = ds === from || ds === to;
          const inRange = from && to && ds >= from && ds <= to;
          return (
            <button
              key={i}
              onClick={() => onPick(ds)}
              className={`relative rounded-lg py-1.5 text-xs ${isEdge ? 'bg-brand-500 text-black' : inRange ? 'bg-brand-500/20 text-white' : hasWorkout ? 'text-white' : 'text-ios-gray'}`}
            >
              {d}
              {hasWorkout && !isEdge && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-400" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[10px] text-ios-gray2">Точкой отмечены дни с тренировками. Нажми день — выбери начало/конец периода.</p>
    </div>
  );
}

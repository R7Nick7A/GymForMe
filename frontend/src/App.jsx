import React, { lazy, Suspense } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Sparkles, CalendarRange, Plus } from 'lucide-react';
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
import Workouts from './pages/Workouts.jsx';
import WorkoutDetail from './pages/WorkoutDetail.jsx';
import NewWorkout from './pages/NewWorkout.jsx';
import Assistant from './pages/Assistant.jsx';
import Plans from './pages/Plans.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

const tabs = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/workouts', label: 'Тренировки', icon: Dumbbell },
  { to: '/new', label: 'Новая', icon: Plus },
  { to: '/plans', label: 'Планы', icon: CalendarRange },
  { to: '/assistant', label: 'Помощник', icon: Sparkles },
];

function Layout() {
  const location = useLocation();
  const hideNav = location.pathname.startsWith('/workouts/') && location.pathname !== '/workouts';
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-5">
        <Routes>
          <Route path="/" element={<Suspense fallback={<div className="p-4 text-ios-gray">Загрузка…</div>}><Dashboard /></Suspense>} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/workouts/:id" element={<WorkoutDetail />} />
          <Route path="/new" element={<NewWorkout />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ios-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-md items-stretch justify-around">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
                    isActive ? 'text-brand-400' : 'text-ios-gray'
                  }`
                }
              >
                <t.icon size={22} strokeWidth={2} />
                <span>{t.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export default function App() {
  return <Layout />;
}

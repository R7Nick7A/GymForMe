import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Sparkles, CalendarRange, Plus } from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import Auth from './pages/Auth.jsx';
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Workouts = lazy(() => import('./pages/Workouts.jsx'));
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail.jsx'));
const NewWorkout = lazy(() => import('./pages/NewWorkout.jsx'));
const Assistant = lazy(() => import('./pages/Assistant.jsx'));
const Plans = lazy(() => import('./pages/Plans.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));

const tabs = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/workouts', label: 'Тренировки', icon: Dumbbell },
  { to: '/new', label: 'Новая', icon: Plus },
  { to: '/plans', label: 'Планы', icon: CalendarRange },
  { to: '/assistant', label: 'Помощник', icon: Sparkles },
];

function Layout() {
  const location = useLocation();
  const mainRef = useRef(null);

  // При смене вкладки — прокрутить в начало (ничего не «уезжает»)
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const hideNav = location.pathname.startsWith('/workouts/') && location.pathname !== '/workouts';
  const isAssistant = location.pathname === '/assistant';

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col md:max-w-lg">
      <main
        ref={mainRef}
        className={`min-h-0 flex-1 px-4 pt-5 ${
          isAssistant ? 'flex flex-col overflow-hidden pb-2' : 'overflow-y-auto pb-4'
        }`}
      >
        <Suspense fallback={<div className="p-4 text-ios-gray">Загрузка…</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/workouts/:id" element={<WorkoutDetail />} />
            <Route path="/new" element={<NewWorkout />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>
      {!hideNav && (
        <nav className="shrink-0 border-t border-white/10 bg-black/90 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex w-full max-w-md items-stretch justify-around md:max-w-lg">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? 'text-brand-400' : 'text-ios-gray'}`
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
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-ios-gray">Загрузка…</div>;
  if (!user) return <Auth />;
  return <Layout />;
}

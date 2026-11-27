import React, { useState } from 'react';
import { Dumbbell, KeyRound, LogIn, UserPlus, LifeBuoy, Copy, Check } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Auth() {
  const { setSession } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | recover
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingCode, setPendingCode] = useState(null); // { token, username, recoveryCode }
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setError('');
  };

  const doLogin = async () => {
    reset();
    setBusy(true);
    try {
      const res = await api.login(username.trim(), password);
      setSession(res.token, res.username);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    reset();
    setBusy(true);
    try {
      const res = await api.register(username.trim(), password);
      setPendingCode(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doRecover = async () => {
    reset();
    setBusy(true);
    try {
      const res = await api.recover(username.trim(), recoveryCode.trim(), newPassword);
      setSession(res.token, res.username);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(pendingCode.recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  // Экран с кодом восстановления после регистрации
  if (pendingCode) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-4 text-center text-3xl">🔑</div>
        <h1 className="mb-2 text-center text-2xl font-bold text-white">Сохрани этот код!</h1>
        <p className="mb-5 text-center text-sm text-ios-gray">
          Это твой <b className="text-white/90">код восстановления</b>. Если забудешь пароль — только по нему сможешь вернуть доступ.
          Запиши его на бумажку или сохрани в заметках.
        </p>
        <div className="mb-5 flex items-center justify-center gap-2 rounded-2xl border border-brand-500/40 bg-ios-surface p-5">
          <span className="text-2xl font-mono font-bold tracking-widest text-brand-400">{pendingCode.recoveryCode}</span>
          <button onClick={copyCode} className="ml-1 rounded-lg p-2 text-ios-gray hover:text-white" title="Скопировать">
            {copied ? <Check size={18} className="text-brand-400" /> : <Copy size={18} />}
          </button>
        </div>
        <button
          onClick={() => setSession(pendingCode.token, pendingCode.username)}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-black"
        >
          Я сохранил код — войти
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500">
          <Dumbbell size={34} className="text-black" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Тренер</h1>
        <p className="text-sm text-ios-gray">Мониторинг тренировочного процесса</p>
      </div>

      {mode === 'login' && (
        <div className="space-y-3">
          <Field label="Имя" value={username} onChange={setUsername} placeholder="Твоё имя" autoFocus />
          <Field label="Пароль" value={password} onChange={setPassword} type="password" placeholder="Пароль" onEnter={doLogin} />
          <button onClick={doLogin} disabled={busy || !username || !password} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-black disabled:opacity-40">
            <LogIn size={18} /> {busy ? 'Вхожу…' : 'Войти'}
          </button>
          <div className="flex justify-between pt-2 text-xs">
            <button onClick={() => { setMode('register'); reset(); }} className="flex items-center gap-1 text-brand-400">
              <UserPlus size={14} /> Регистрация
            </button>
            <button onClick={() => { setMode('recover'); reset(); }} className="flex items-center gap-1 text-ios-gray">
              <LifeBuoy size={14} /> Забыл пароль
            </button>
          </div>
        </div>
      )}

      {mode === 'register' && (
        <div className="space-y-3">
          <Field label="Имя" value={username} onChange={setUsername} placeholder="Придумай имя (уникальное)" autoFocus />
          <Field label="Пароль" value={password} onChange={setPassword} type="password" placeholder="Не короче 4 символов" onEnter={doRegister} />
          <button onClick={doRegister} disabled={busy || !username || !password} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-black disabled:opacity-40">
            <UserPlus size={18} /> {busy ? 'Создаю…' : 'Создать аккаунт'}
          </button>
          <p className="pt-1 text-center text-xs text-ios-gray2">
            Без почты. Просто имя и пароль. Имя должно быть уникальным.
          </p>
          <button onClick={() => { setMode('login'); reset(); }} className="w-full pt-2 text-center text-xs text-brand-400">
            Уже есть аккаунт? Войти
          </button>
        </div>
      )}

      {mode === 'recover' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-ios-orange/30 bg-ios-surface p-3 text-xs text-ios-gray">
            Введи имя, код восстановления (который получил при регистрации) и новый пароль.
          </div>
          <Field label="Имя" value={username} onChange={setUsername} placeholder="Твоё имя" autoFocus />
          <Field label="Код восстановления" value={recoveryCode} onChange={setRecoveryCode} placeholder="Например, A1B2C3D4E5F6" />
          <Field label="Новый пароль" value={newPassword} onChange={setNewPassword} type="password" placeholder="Не короче 4 символов" onEnter={doRecover} />
          <button onClick={doRecover} disabled={busy || !username || !recoveryCode || !newPassword} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-black disabled:opacity-40">
            <KeyRound size={18} /> {busy ? 'Восстанавливаю…' : 'Восстановить доступ'}
          </button>
          <button onClick={() => { setMode('login'); reset(); }} className="w-full pt-2 text-center text-xs text-brand-400">
            Назад ко входу
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-center text-sm text-rose-400">{error}</p>}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, autoFocus, onEnter }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ios-gray">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoCapitalize="off"
        autoCorrect="off"
        className="w-full rounded-xl border border-white/10 bg-ios-surface px-3 py-3 text-sm text-white outline-none focus:border-brand-500"
      />
    </label>
  );
}

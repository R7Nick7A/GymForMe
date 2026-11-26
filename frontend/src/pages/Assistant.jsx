import React, { useEffect, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { api } from '../api.js';

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = React.useRef(null);

  useEffect(() => {
    api.messages().then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    try {
      const res = await api.sendMessage(text);
      setMessages((m) => [...m, res.user, res.assistant]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: 'Ошибка: ' + e.message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      <header className="mb-3">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-white">
          <Sparkles className="text-brand-400" size={22} /> ИИ-помощник
        </h1>
        <p className="text-sm text-ios-gray">Видит все твои тренировки и анализирует их</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-ios-gray2">
            Задай вопрос про свои тренировки, прогресс или план.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user' ? 'bg-brand-500 text-black' : 'bg-ios-surface2 text-white'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 pb-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Спроси про тренировки…"
          className="max-h-28 flex-1 resize-none rounded-xl border border-white/10 bg-ios-surface px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
        />
        <button onClick={send} disabled={busy} className="rounded-xl bg-brand-500 p-3 text-black disabled:opacity-50">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

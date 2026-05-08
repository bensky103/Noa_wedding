'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Mode = 'login' | 'logout' | null;

export default function AdminGate() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [keyValue, setKeyValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setIsAdmin(!!window.sessionStorage.getItem('noa.adminKey'));
    } catch {
      // ignore
    }
  }, []);

  const closeModal = useCallback(() => {
    setMode(null);
    setKeyValue('');
    setError(null);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (mode === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, closeModal]);

  useEffect(() => {
    if (mode === 'login') {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [mode]);

  const dispatchChanged = () => {
    try {
      window.dispatchEvent(new CustomEvent('noa:admin-changed'));
    } catch {
      // ignore
    }
  };

  const onButtonClick = () => {
    if (isAdmin) {
      setMode('logout');
    } else {
      setMode('login');
      setKeyValue('');
      setError(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const key = keyValue;
    if (!key) {
      setError('מפתח לא תקין');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        try {
          window.sessionStorage.setItem('noa.adminKey', key);
        } catch {
          // ignore
        }
        setIsAdmin(true);
        dispatchChanged();
        closeModal();
        return;
      }
      if (res.status === 403) {
        setError('מפתח לא תקין');
      } else {
        setError('שגיאה, נסו שוב');
      }
    } catch {
      setError('שגיאה, נסו שוב');
    } finally {
      setBusy(false);
    }
  };

  const confirmLogout = () => {
    try {
      window.sessionStorage.removeItem('noa.adminKey');
    } catch {
      // ignore
    }
    setIsAdmin(false);
    dispatchChanged();
    closeModal();
  };

  const buttonLabel = isAdmin ? 'יציאה ממצב ניהול' : 'כניסה למצב ניהול';
  const buttonColor = isAdmin
    ? 'text-rose-500 hover:text-rose-600'
    : 'text-stone-400 hover:text-stone-600';

  return (
    <>
      <button
        type="button"
        onClick={onButtonClick}
        aria-label={buttonLabel}
        className={`fixed top-3 start-3 z-30 p-2 rounded-full bg-white/60 backdrop-blur-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-rose-500 ${buttonColor}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {mode === 'login' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-gate-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <form
            onSubmit={onSubmit}
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4"
          >
            <h2
              id="admin-gate-title"
              className="text-xl font-bold text-stone-900 text-center"
            >
              כניסה למצב ניהול
            </h2>
            <p className="text-sm text-stone-600 text-center">
              הזינו את מפתח הניהול
            </p>
            <input
              ref={inputRef}
              type="password"
              autoComplete="off"
              placeholder="מפתח ניהול"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-stone-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent disabled:bg-stone-100"
            />
            {error && (
              <p
                role="alert"
                className="text-sm text-rose-600 text-center"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || keyValue.length === 0}
              className="w-full min-h-[44px] rounded-lg bg-rose-600 text-white font-bold transition hover:bg-rose-700 disabled:bg-stone-300 disabled:cursor-not-allowed"
            >
              {busy ? 'בודק...' : 'כניסה'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              disabled={busy}
              className="w-full min-h-[44px] rounded-lg bg-transparent text-stone-600 transition hover:text-stone-900 disabled:opacity-50"
            >
              ביטול
            </button>
          </form>
        </div>
      )}

      {mode === 'logout' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-logout-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <h2
              id="admin-logout-title"
              className="text-xl font-bold text-stone-900 text-center"
            >
              לצאת ממצב ניהול?
            </h2>
            <button
              type="button"
              onClick={confirmLogout}
              className="w-full min-h-[44px] rounded-lg bg-rose-600 text-white font-bold transition hover:bg-rose-700"
            >
              כן, צא
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="w-full min-h-[44px] rounded-lg bg-transparent text-stone-600 transition hover:text-stone-900"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </>
  );
}

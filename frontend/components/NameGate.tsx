'use client';

import { useEffect, useRef, useState } from 'react';
import { setUploaderName } from '@/lib/identity';

type Props = {
  open: boolean;
  onClose: () => void;
  required?: boolean;
};

export default function NameGate({ open, onClose, required }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setUploaderName(trimmed);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-stone-900 text-center">
          ברוכים הבאים לחתונה של נועה ❤️
        </h2>
        <p className="text-sm text-stone-600 text-center">
          מי אתם? נשמח שהשם שלכם יופיע ליד התמונות שתעלו
        </p>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          maxLength={30}
          placeholder="השם שלכם"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full min-h-[44px] rounded-lg bg-rose-600 text-white font-bold transition hover:bg-rose-700 disabled:bg-stone-300 disabled:cursor-not-allowed"
        >
          המשך
        </button>
        {!required && (
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-lg bg-transparent text-stone-600 transition hover:text-stone-900"
          >
            אני רק צופה
          </button>
        )}
      </form>
    </div>
  );
}

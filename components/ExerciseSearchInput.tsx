"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Suggestion {
  name: string;
  target: string;
  bodyPart: string;
  equipment: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onMuscleSelect: (muscle: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function ExerciseSearchInput({ value, onChange, onMuscleSelect, placeholder, autoFocus }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/exercise-search?q=${encodeURIComponent(q)}`);
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (s: Suggestion) => {
    onChange(s.name);
    onMuscleSelect(s.target);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "z.B. Bankdrücken"}
          autoFocus={autoFocus}
          className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-8"
        />
        {loading && (
          <svg className="absolute right-2.5 top-2.5 animate-spin text-slate-300" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); pick(s); }}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 active:bg-blue-100 flex flex-col gap-0.5"
              >
                <span className="text-sm font-medium text-slate-800 capitalize">{s.name}</span>
                <span className="text-xs text-slate-400 capitalize">{s.target} · {s.bodyPart} · {s.equipment}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

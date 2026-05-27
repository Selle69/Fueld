"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/lib/db/init";

const STORAGE_KEY = "sleep_prompt_date";
const TODAY = new Date().toISOString().split("T")[0];

export function qualityColor(q: number): string {
  if (q <= 3) return "bg-rose-500 text-white";
  if (q <= 6) return "bg-amber-400 text-white";
  return "bg-emerald-500 text-white";
}

export function qualityLabel(q: number): string {
  if (q <= 2) return "Sehr schlecht";
  if (q <= 4) return "Schlecht";
  if (q <= 6) return "Mittelmäßig";
  if (q <= 8) return "Gut";
  return "Ausgezeichnet";
}

export default function SleepPrompt() {
  const [visible, setVisible] = useState(false);
  const [quality, setQuality] = useState(0);
  const [hours, setHours] = useState(7.5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const last = localStorage.getItem(STORAGE_KEY);
    if (last !== TODAY) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, TODAY);
    setVisible(false);
  };

  const save = async () => {
    if (!quality) return;
    setSaving(true);
    try {
      const db = await getDb();
      await db.runAsync(
        `INSERT OR REPLACE INTO sleep_log (profile_id, date, quality, duration_h) VALUES (1, ?, ?, ?)`,
        [TODAY, quality, hours],
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-4 pb-6">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl">
            🌙
          </div>
          <h2 className="text-lg font-bold text-slate-800">Wie hast du geschlafen?</h2>
          <p className="text-sm text-slate-400">Bewerte deine letzte Nacht</p>
        </div>

        {/* Hours stepper */}
        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-xs text-slate-500 text-center mb-3">Schlafdauer</p>
          <div className="flex items-center justify-center gap-5">
            <button
              onClick={() => setHours(h => Math.max(0, +(h - 0.5).toFixed(1)))}
              className="w-10 h-10 rounded-full bg-white shadow text-slate-600 text-xl font-bold flex items-center justify-center active:bg-slate-100"
            >
              −
            </button>
            <div className="text-center min-w-[72px]">
              <span className="text-3xl font-bold text-slate-800">{hours}</span>
              <span className="text-base text-slate-400 ml-1">h</span>
            </div>
            <button
              onClick={() => setHours(h => Math.min(14, +(h + 0.5).toFixed(1)))}
              className="w-10 h-10 rounded-full bg-white shadow text-slate-600 text-xl font-bold flex items-center justify-center active:bg-slate-100"
            >
              +
            </button>
          </div>
        </div>

        {/* Quality scale */}
        <div>
          <p className="text-xs text-slate-500 text-center mb-3">Schlafqualität</p>
          <div className="flex gap-1.5 justify-center flex-wrap">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setQuality(n)}
                className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                  quality === n
                    ? qualityColor(n)
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1.5 px-1">
            <span>Schlecht</span>
            <span>Sehr gut</span>
          </div>
          {quality > 0 && (
            <p className="text-sm font-semibold text-slate-600 text-center mt-2">
              {qualityLabel(quality)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={dismiss}
            className="bg-slate-100 text-slate-600 rounded-xl py-3 font-semibold text-sm"
          >
            Überspringen
          </button>
          <button
            onClick={save}
            disabled={!quality || saving}
            className="bg-indigo-500 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-40"
          >
            {saving ? "..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/lib/db/init";
import { LineChart } from "@/components/charts";
import type { LinePoint } from "@/components/charts";
import { qualityColor, qualityLabel } from "@/components/SleepPrompt";

const TODAY = new Date().toISOString().split("T")[0];

interface SleepRow {
  date: string;
  quality: number;
  duration_h: number | null;
}

const RANGES = [
  { label: "7T", days: 7 },
  { label: "14T", days: 14 },
  { label: "30T", days: 30 },
  { label: "90T", days: 90 },
] as const;
type Days = 7 | 14 | 30 | 90;

function getStartDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().split("T")[0];
}

function fmtDateFull(s: string): string {
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("de-DE", {
      weekday: "short", day: "2-digit", month: "2-digit",
    });
  } catch { return s; }
}

function sleepTextColor(q: number): string {
  if (q <= 3) return "text-rose-500";
  if (q <= 6) return "text-amber-500";
  return "text-emerald-500";
}

export default function SleepPage() {
  const [days, setDays] = useState<Days>(14);
  const [log, setLog] = useState<SleepRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Today's edit state
  const [todayEntry, setTodayEntry] = useState<SleepRow | null>(null);
  const [editQuality, setEditQuality] = useState(0);
  const [editHours, setEditHours] = useState(7.5);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<SleepRow>(
        `SELECT date, quality, duration_h FROM sleep_log
         WHERE profile_id = 1 AND date >= ? ORDER BY date ASC`,
        [getStartDate(days)],
      );
      setLog(rows);

      const today = await db.getFirstAsync<SleepRow>(
        `SELECT date, quality, duration_h FROM sleep_log WHERE profile_id = 1 AND date = ?`,
        [TODAY],
      );
      setTodayEntry(today);
      if (today) {
        setEditQuality(today.quality);
        setEditHours(today.duration_h ?? 7.5);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [days]);

  const handleSaveToday = async () => {
    if (!editQuality) return;
    setSaving(true);
    try {
      const db = await getDb();
      await db.runAsync(
        `INSERT OR REPLACE INTO sleep_log (profile_id, date, quality, duration_h) VALUES (1, ?, ?, ?)`,
        [TODAY, editQuality, editHours],
      );
      await load();
      setShowEdit(false);
    } finally {
      setSaving(false);
    }
  };

  const qualityLine: LinePoint[] = log.map(s => ({ x: s.date, y: s.quality }));
  const durationLine: LinePoint[] = log
    .filter(s => s.duration_h != null)
    .map(s => ({ x: s.date, y: s.duration_h! }));

  const withQuality = log.filter(s => s.quality > 0);
  const withDuration = log.filter(s => s.duration_h != null);
  const avgQuality = withQuality.length
    ? +(withQuality.reduce((a, b) => a + b.quality, 0) / withQuality.length).toFixed(1)
    : null;
  const avgHours = withDuration.length
    ? +(withDuration.reduce((a, b) => a + b.duration_h!, 0) / withDuration.length).toFixed(1)
    : null;

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌙</span>
          <h1 className="text-xl font-bold text-slate-800">Schlaf</h1>
        </div>

        {/* Range picker */}
        <div className="flex gap-2">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                days === r.days ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* Today's entry */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Heute</h2>
            <button
              onClick={() => { setShowEdit(v => !v); if (!showEdit && !todayEntry) { setEditQuality(0); setEditHours(7.5); } }}
              className="text-indigo-500 text-sm font-semibold"
            >
              {showEdit ? "Abbrechen" : todayEntry ? "Bearbeiten" : "Eintragen"}
            </button>
          </div>

          {!showEdit && todayEntry && (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-0.5">Qualität</p>
                <span className={`text-2xl font-bold ${sleepTextColor(todayEntry.quality)}`}>
                  {todayEntry.quality}
                  <span className="text-sm font-normal text-slate-400">/10</span>
                </span>
                <p className="text-xs text-slate-500 mt-0.5">{qualityLabel(todayEntry.quality)}</p>
              </div>
              {todayEntry.duration_h != null && (
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-0.5">Dauer</p>
                  <span className="text-2xl font-bold text-slate-800">
                    {todayEntry.duration_h}
                    <span className="text-sm font-normal text-slate-400"> h</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {!showEdit && !todayEntry && (
            <p className="text-sm text-slate-400">Noch kein Eintrag für heute.</p>
          )}

          {showEdit && (
            <div className="space-y-4">
              {/* Hours stepper */}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 text-center mb-2">Schlafdauer</p>
                <div className="flex items-center justify-center gap-5">
                  <button
                    onClick={() => setEditHours(h => Math.max(0, +(h - 0.5).toFixed(1)))}
                    className="w-9 h-9 rounded-full bg-white shadow text-slate-600 text-lg font-bold flex items-center justify-center"
                  >
                    −
                  </button>
                  <div className="min-w-[60px] text-center">
                    <span className="text-2xl font-bold text-slate-800">{editHours}</span>
                    <span className="text-sm text-slate-400 ml-1">h</span>
                  </div>
                  <button
                    onClick={() => setEditHours(h => Math.min(14, +(h + 0.5).toFixed(1)))}
                    className="w-9 h-9 rounded-full bg-white shadow text-slate-600 text-lg font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quality buttons */}
              <div>
                <p className="text-xs text-slate-500 text-center mb-2">Schlafqualität</p>
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setEditQuality(n)}
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                        editQuality === n
                          ? qualityColor(n)
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
                  <span>Schlecht</span>
                  <span>Sehr gut</span>
                </div>
                {editQuality > 0 && (
                  <p className="text-xs font-semibold text-slate-600 text-center mt-1.5">
                    {qualityLabel(editQuality)}
                  </p>
                )}
              </div>

              <button
                onClick={handleSaveToday}
                disabled={!editQuality || saving}
                className="w-full bg-indigo-500 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-40"
              >
                {saving ? "Wird gespeichert..." : "Speichern"}
              </button>
            </div>
          )}
        </div>

        {loading ? null : log.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-sm text-slate-400">Noch keine Einträge im gewählten Zeitraum.</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Ø Qualität</p>
                <p className={`text-2xl font-bold ${sleepTextColor(avgQuality ?? 0)}`}>
                  {avgQuality ?? "–"}
                  <span className="text-sm font-normal text-slate-400">/10</span>
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Ø Schlafdauer</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {avgHours ?? "–"}
                  <span className="text-sm font-normal text-slate-400"> h</span>
                </p>
              </div>
            </div>

            {/* Quality chart */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h2 className="font-semibold text-slate-800 mb-3">Schlafqualität</h2>
              <LineChart data={qualityLine} color="#6366F1" targetY={7} />
              <p className="text-xs text-slate-400 mt-1 text-center">Gestrichelt = Ziel 7/10</p>
            </div>

            {/* Duration chart */}
            {durationLine.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h2 className="font-semibold text-slate-800 mb-3">Schlafdauer (Stunden)</h2>
                <LineChart data={durationLine} color="#8B5CF6" targetY={8} unit=" h" />
                <p className="text-xs text-slate-400 mt-1 text-center">Gestrichelt = Ziel 8 h</p>
              </div>
            )}

            {/* Entry list */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h2 className="font-semibold text-slate-800 mb-3">Verlauf</h2>
              <div className="divide-y divide-slate-100">
                {[...log].reverse().map(s => (
                  <div key={s.date} className="flex items-center justify-between py-2.5">
                    <p className="text-sm text-slate-600">{fmtDateFull(s.date)}</p>
                    <div className="flex items-center gap-3">
                      {s.duration_h != null && (
                        <span className="text-xs text-slate-400">{s.duration_h} h</span>
                      )}
                      <span className={`text-sm font-bold ${sleepTextColor(s.quality)}`}>
                        {s.quality}/10
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

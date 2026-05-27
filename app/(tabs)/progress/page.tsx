"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/lib/db/init";
import Spinner from "@/components/Spinner";

interface BodyLogEntry {
  id: number;
  date: string;
  weight_kg: number;
}

interface DailySummaryEntry {
  date: string;
  total_kcal: number;
  kcal_target: number | null;
}

interface ExercisePR {
  id: number;
  exercise_name: string;
  session_date: string;
  max_weight_kg: number;
  sets_done: number | null;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  } catch {
    return dateStr;
  }
}

function formatDateFull(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function isoDate(): string {
  return new Date().toISOString().split("T")[0];
}

// Get last 7 days as date strings
function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

export default function ProgressPage() {
  const [bodyLog, setBodyLog] = useState<BodyLogEntry[]>([]);
  const [weekKcal, setWeekKcal] = useState<DailySummaryEntry[]>([]);
  const [prs, setPrs] = useState<ExercisePR[]>([]);
  const [loading, setLoading] = useState(true);

  // Body log form
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [weightDate, setWeightDate] = useState(isoDate());
  const [weightValue, setWeightValue] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  const loadData = async () => {
    try {
      const db = await getDb();

      const bodyRows = await db.getAllAsync<BodyLogEntry>(
        `SELECT id, date, weight_kg FROM body_log WHERE profile_id = 1 ORDER BY date DESC LIMIT 10`
      );
      setBodyLog(bodyRows);

      const last7 = getLast7Days();
      const summaryRows = await db.getAllAsync<DailySummaryEntry>(
        `SELECT date, total_kcal, kcal_target FROM daily_summary
         WHERE profile_id = 1 AND date >= ?
         ORDER BY date ASC`,
        [last7[0]]
      );
      // Fill in missing days
      const summaryMap: Record<string, DailySummaryEntry> = {};
      for (const r of summaryRows) summaryMap[r.date] = r;
      const filledWeek: DailySummaryEntry[] = last7.map(date =>
        summaryMap[date] ?? { date, total_kcal: 0, kcal_target: null }
      );
      setWeekKcal(filledWeek);

      const prRows = await db.getAllAsync<ExercisePR>(
        `SELECT id, exercise_name, session_date, max_weight_kg, sets_done
         FROM exercise_history
         WHERE profile_id = 1 AND is_pr = 1
         ORDER BY session_date DESC
         LIMIT 5`
      );
      setPrs(prRows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveWeight = async () => {
    if (!weightValue) return;
    setSavingWeight(true);
    try {
      const db = await getDb();
      await db.runAsync(
        `INSERT OR REPLACE INTO body_log (profile_id, date, weight_kg) VALUES (1, ?, ?)`,
        [weightDate, parseFloat(weightValue)]
      );
      setWeightValue("");
      setShowWeightForm(false);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingWeight(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  const maxWeight = bodyLog.length > 0 ? Math.max(...bodyLog.map(e => e.weight_kg)) : 100;
  const maxKcal = Math.max(...weekKcal.map(e => Math.max(e.total_kcal, e.kcal_target ?? 0)), 1000);

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Fortschritt</h1>

      {/* Körpergewicht */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Körpergewicht</h2>
          <button
            onClick={() => setShowWeightForm(v => !v)}
            className="text-blue-500 text-sm font-semibold"
          >
            {showWeightForm ? "Abbrechen" : "Eintragen"}
          </button>
        </div>

        {showWeightForm && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Datum</label>
                <input
                  type="date"
                  value={weightDate}
                  onChange={e => setWeightDate(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Gewicht (kg)</label>
                <input
                  type="number"
                  value={weightValue}
                  onChange={e => setWeightValue(e.target.value)}
                  placeholder="75.0"
                  min="20"
                  max="300"
                  step="0.1"
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleSaveWeight}
              disabled={savingWeight || !weightValue}
              className="bg-blue-500 text-white rounded-xl px-4 py-2 font-semibold w-full text-sm active:opacity-90 disabled:opacity-60"
            >
              {savingWeight ? "Wird gespeichert..." : "Speichern"}
            </button>
          </div>
        )}

        {bodyLog.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Noch kein Gewicht eingetragen</p>
        ) : (
          <div className="space-y-2">
            {bodyLog.map(entry => {
              const barWidth = maxWeight > 0 ? Math.round((entry.weight_kg / maxWeight) * 100) : 0;
              return (
                <div key={entry.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">{formatDateFull(entry.date)}</span>
                    <span className="font-semibold text-slate-700">{entry.weight_kg} kg</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-400 h-2 rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wochenkalorien */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">Kalorien letzte 7 Tage</h2>
        <div className="space-y-2">
          {weekKcal.map(entry => {
            const barWidth = maxKcal > 0 ? Math.round((entry.total_kcal / maxKcal) * 100) : 0;
            const targetWidth = entry.kcal_target && maxKcal > 0
              ? Math.round((entry.kcal_target / maxKcal) * 100)
              : null;
            return (
              <div key={entry.date} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">{formatDate(entry.date)}</span>
                  <span className="font-semibold text-slate-700">
                    {Math.round(entry.total_kcal)}
                    {entry.kcal_target ? ` / ${entry.kcal_target}` : ""}
                    {" "}kcal
                  </span>
                </div>
                <div className="relative w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-400 h-2 rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                  {targetWidth != null && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                      style={{ left: `${targetWidth}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Persönliche Rekorde */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">Persönliche Rekorde</h2>
        {prs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Noch keine Rekorde</p>
        ) : (
          <div className="space-y-3">
            {prs.map(pr => (
              <div key={pr.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{pr.exercise_name}</p>
                  <p className="text-xs text-slate-400">{formatDateFull(pr.session_date)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-500">{pr.max_weight_kg} kg</p>
                  {pr.sets_done != null && (
                    <p className="text-xs text-slate-400">{pr.sets_done} Sätze</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

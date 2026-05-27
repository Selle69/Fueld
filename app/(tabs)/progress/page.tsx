"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/lib/db/init";
import { useProfileStore } from "@/store/profileStore";
import Spinner from "@/components/Spinner";
import {
  LineChart, BarChart, MacroStackedChart, HBarChart, SparkLine,
} from "@/components/charts";
import type { LinePoint, BarPoint, MacroDay, HBarItem } from "@/components/charts";

// ─── Data types ───────────────────────────────────────────────────────────────
interface DailyMacro {
  date: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface TrainingRow {
  date: string;
  total_volume_kg: number | null;
  duration_min: number | null;
}

interface ExProgress {
  session_date: string;
  max_weight_kg: number | null;
  total_volume: number | null;
}

interface MuscleVol {
  muscle_group: string;
  volume: number;
}

interface BodyRow {
  date: string;
  weight_kg: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStartDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().split("T")[0];
}

function fillMacroDays(rows: DailyMacro[], startDate: string, days: number): DailyMacro[] {
  const map: Record<string, DailyMacro> = {};
  for (const r of rows) map[r.date] = r;
  const out: DailyMacro[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate + "T00:00:00");
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    out.push(map[key] ?? { date: key, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  }
  return out;
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fmtDateFull(s: string): string {
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return s; }
}

// ─── Config ───────────────────────────────────────────────────────────────────
const RANGES = [
  { label: "7T", days: 7 },
  { label: "14T", days: 14 },
  { label: "30T", days: 30 },
  { label: "90T", days: 90 },
] as const;
type Days = 7 | 14 | 30 | 90;

type Tab = "makros" | "training" | "uebungen" | "muskel" | "koerper";
const TABS: { id: Tab; label: string }[] = [
  { id: "makros", label: "Makros" },
  { id: "training", label: "Training" },
  { id: "uebungen", label: "Übungen" },
  { id: "muskel", label: "Muskelgruppen" },
  { id: "koerper", label: "Körper" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const { profile } = useProfileStore();

  const [days, setDays] = useState<Days>(7);
  const [tab, setTab] = useState<Tab>("makros");
  const [loading, setLoading] = useState(true);

  const [macros, setMacros] = useState<DailyMacro[]>([]);
  const [sessions, setSessions] = useState<TrainingRow[]>([]);
  const [exercises, setExercises] = useState<string[]>([]);
  const [selectedEx, setSelectedEx] = useState<string>("");
  const [exProgress, setExProgress] = useState<ExProgress[]>([]);
  const [muscleVol, setMuscleVol] = useState<MuscleVol[]>([]);
  const [bodyLog, setBodyLog] = useState<BodyRow[]>([]);

  // Weight form
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [weightDate, setWeightDate] = useState(new Date().toISOString().split("T")[0]);
  const [weightValue, setWeightValue] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  // Load all data when days changes
  useEffect(() => {
    let active = true;
    setLoading(true);

    (async () => {
      try {
        const db = await getDb();
        const startDate = getStartDate(days);

        const macroRows = await db.getAllAsync<DailyMacro>(
          `SELECT date,
            COALESCE(SUM(kcal), 0) as kcal,
            COALESCE(SUM(protein_g), 0) as protein_g,
            COALESCE(SUM(carbs_g), 0) as carbs_g,
            COALESCE(SUM(fat_g), 0) as fat_g
           FROM meal_log WHERE profile_id = 1 AND date >= ?
           GROUP BY date ORDER BY date ASC`,
          [startDate],
        );

        const sessionRows = await db.getAllAsync<TrainingRow>(
          `SELECT date, total_volume_kg, duration_min
           FROM training_session
           WHERE profile_id = 1 AND date >= ? AND finished_at IS NOT NULL
           ORDER BY date ASC`,
          [startDate],
        );

        const exRows = await db.getAllAsync<{ exercise_name: string }>(
          `SELECT DISTINCT exercise_name FROM exercise_history
           WHERE profile_id = 1 ORDER BY exercise_name ASC`,
        );

        const muscleRows = await db.getAllAsync<MuscleVol>(
          `SELECT
            COALESCE(
              (SELECT muscle_group FROM exercise WHERE name = eh.exercise_name LIMIT 1),
              (SELECT muscle_group FROM template_exercise WHERE name = eh.exercise_name LIMIT 1),
              'Unbekannt'
            ) as muscle_group,
            COALESCE(SUM(eh.total_volume), 0) as volume
           FROM exercise_history eh
           WHERE eh.profile_id = 1 AND eh.session_date >= ?
           GROUP BY muscle_group ORDER BY volume DESC`,
          [startDate],
        );

        const bodyRows = await db.getAllAsync<BodyRow>(
          `SELECT date, weight_kg FROM body_log
           WHERE profile_id = 1 AND date >= ? ORDER BY date ASC`,
          [startDate],
        );

        const exNames = exRows.map(r => r.exercise_name);

        if (!active) return;
        setMacros(fillMacroDays(macroRows, startDate, days));
        setSessions(sessionRows);
        setExercises(exNames);
        setSelectedEx(prev => (prev && exNames.includes(prev) ? prev : exNames[0] ?? ""));
        setMuscleVol(muscleRows.filter(r => r.volume > 0));
        setBodyLog(bodyRows);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [days]);

  // Load exercise progress when exercise or days changes
  useEffect(() => {
    if (!selectedEx) return;
    let active = true;

    (async () => {
      try {
        const db = await getDb();
        const rows = await db.getAllAsync<ExProgress>(
          `SELECT session_date, max_weight_kg, total_volume
           FROM exercise_history
           WHERE profile_id = 1 AND exercise_name = ? AND session_date >= ?
           ORDER BY session_date ASC`,
          [selectedEx, getStartDate(days)],
        );
        if (active) setExProgress(rows);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => { active = false; };
  }, [selectedEx, days]);

  const handleSaveWeight = async () => {
    if (!weightValue) return;
    setSavingWeight(true);
    try {
      const db = await getDb();
      await db.runAsync(
        `INSERT OR REPLACE INTO body_log (profile_id, date, weight_kg) VALUES (1, ?, ?)`,
        [weightDate, parseFloat(weightValue)],
      );
      setWeightValue("");
      setShowWeightForm(false);
      const startDate = getStartDate(days);
      const rows = await db.getAllAsync<BodyRow>(
        `SELECT date, weight_kg FROM body_log WHERE profile_id = 1 AND date >= ? ORDER BY date ASC`,
        [startDate],
      );
      setBodyLog(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingWeight(false);
    }
  };

  if (loading) return <Spinner />;

  // ── Derived chart data ────────────────────────────────────────────────────
  const macroChartData: MacroDay[] = macros.map(m => ({
    x: m.date,
    protein_kcal: Math.round(m.protein_g * 4),
    carbs_kcal: Math.round(m.carbs_g * 4),
    fat_kcal: Math.round(m.fat_g * 9),
    target_kcal: profile?.daily_kcal_target ?? undefined,
  }));

  const proteinSpark = macros.map(m => m.protein_g);
  const carbsSpark = macros.map(m => m.carbs_g);
  const fatSpark = macros.map(m => m.fat_g);
  const avgProtein = Math.round(avg(macros.filter(m => m.protein_g > 0).map(m => m.protein_g)));
  const avgCarbs = Math.round(avg(macros.filter(m => m.carbs_g > 0).map(m => m.carbs_g)));
  const avgFat = Math.round(avg(macros.filter(m => m.fat_g > 0).map(m => m.fat_g)));

  const volumeLine: LinePoint[] = sessions
    .filter(s => (s.total_volume_kg ?? 0) > 0)
    .map(s => ({ x: s.date, y: Math.round(s.total_volume_kg!) }));

  const durationBars: BarPoint[] = sessions
    .filter(s => (s.duration_min ?? 0) > 0)
    .map(s => ({ x: s.date, y: s.duration_min! }));

  const exWeightLine: LinePoint[] = exProgress
    .filter(p => p.max_weight_kg != null)
    .map(p => ({ x: p.session_date, y: p.max_weight_kg! }));

  const exVolumeLine: LinePoint[] = exProgress
    .filter(p => p.total_volume != null)
    .map(p => ({ x: p.session_date, y: Math.round(p.total_volume!) }));

  const muscleHBars: HBarItem[] = muscleVol.map(m => ({
    label: m.muscle_group,
    value: Math.round(m.volume),
  }));

  const bodyLine: LinePoint[] = bodyLog.map(b => ({ x: b.date, y: b.weight_kg }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-28">
      {/* Header + Range picker */}
      <div className="px-4 pt-6 pb-3 space-y-3">
        <h1 className="text-xl font-bold text-slate-800">Fortschritt</h1>
        <div className="flex gap-2">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                days === r.days ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 overflow-x-auto pb-2 no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
              tab === t.id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-2 space-y-4">

        {/* ══ MAKROS ══════════════════════════════════════════════════════════ */}
        {tab === "makros" && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-slate-800">Kalorien</h2>
                {profile?.daily_kcal_target && (
                  <span className="text-xs text-slate-400">Ziel {profile.daily_kcal_target} kcal</span>
                )}
              </div>
              <MacroStackedChart data={macroChartData} />
              <div className="flex gap-4 mt-2 justify-center">
                {[
                  { label: "Protein", color: "bg-blue-500" },
                  { label: "Kohlenhydrate", color: "bg-green-500" },
                  { label: "Fett", color: "bg-orange-500" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                    <span className="text-xs text-slate-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini macro cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Protein", color: "#3B82F6", textColor: "text-blue-500",
                  spark: proteinSpark, avg: avgProtein,
                  target: profile?.protein_target_g,
                },
                {
                  label: "Carbs", color: "#22C55E", textColor: "text-green-500",
                  spark: carbsSpark, avg: avgCarbs,
                  target: profile?.carbs_target_g,
                },
                {
                  label: "Fett", color: "#F97316", textColor: "text-orange-500",
                  spark: fatSpark, avg: avgFat,
                  target: profile?.fat_target_g,
                },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-2xl shadow-sm p-3">
                  <p className={`text-xs font-semibold ${card.textColor} mb-1`}>{card.label}</p>
                  <SparkLine data={card.spark} color={card.color} />
                  <p className="text-xs font-bold text-slate-700 mt-1">∅ {card.avg}g</p>
                  {card.target != null && (
                    <p className="text-xs text-slate-400">/ {Math.round(card.target)}g</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══ TRAINING ════════════════════════════════════════════════════════ */}
        {tab === "training" && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h2 className="font-semibold text-slate-800 mb-3">Trainingsvolumen (kg)</h2>
              <LineChart data={volumeLine} color="#3B82F6" unit=" kg" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h2 className="font-semibold text-slate-800 mb-3">Dauer (Minuten)</h2>
              <BarChart data={durationBars} color="#A78BFA" unit=" min" />
            </div>

            {sessions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h2 className="font-semibold text-slate-800 mb-3">
                  Sessions ({sessions.length})
                </h2>
                <div className="space-y-0 divide-y divide-slate-100">
                  {[...sessions].reverse().map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <p className="text-sm text-slate-600">{fmtDateFull(s.date)}</p>
                      <div className="flex gap-3 text-xs text-slate-500">
                        {s.total_volume_kg != null && (
                          <span className="font-semibold text-slate-700">
                            {Math.round(s.total_volume_kg)} kg
                          </span>
                        )}
                        {s.duration_min != null && <span>{s.duration_min} min</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sessions.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-sm text-slate-400">
                Noch keine abgeschlossenen Trainings im Zeitraum
              </div>
            )}
          </>
        )}

        {/* ══ ÜBUNGEN ═════════════════════════════════════════════════════════ */}
        {tab === "uebungen" && (
          <>
            {exercises.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-sm text-slate-400">
                Noch keine Trainingseinheiten abgeschlossen
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <label className="block text-sm text-slate-500 mb-2">Übung auswählen</label>
                  <select
                    value={selectedEx}
                    onChange={e => setSelectedEx(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    {exercises.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <h2 className="font-semibold text-slate-800 mb-3">Max. Gewicht (kg)</h2>
                  <LineChart data={exWeightLine} color="#3B82F6" unit=" kg" />
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <h2 className="font-semibold text-slate-800 mb-3">Volumen pro Session (kg)</h2>
                  <LineChart data={exVolumeLine} color="#A78BFA" unit=" kg" />
                </div>
              </>
            )}
          </>
        )}

        {/* ══ MUSKELGRUPPEN ═══════════════════════════════════════════════════ */}
        {tab === "muskel" && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h2 className="font-semibold text-slate-800 mb-4">
              Volumen pro Muskelgruppe (kg)
            </h2>
            {muscleHBars.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Noch kein Trainingsvolumen im Zeitraum
              </p>
            ) : (
              <HBarChart data={muscleHBars} unit=" kg" />
            )}
          </div>
        )}

        {/* ══ KÖRPER ══════════════════════════════════════════════════════════ */}
        {tab === "koerper" && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-800">Körpergewicht (kg)</h2>
                <button
                  onClick={() => setShowWeightForm(v => !v)}
                  className="text-blue-500 text-sm font-semibold"
                >
                  {showWeightForm ? "Abbrechen" : "Eintragen"}
                </button>
              </div>

              {showWeightForm && (
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Datum</label>
                      <input
                        type="date"
                        value={weightDate}
                        onChange={e => setWeightDate(e.target.value)}
                        className="border border-slate-200 rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Gewicht (kg)</label>
                      <input
                        type="number"
                        value={weightValue}
                        onChange={e => setWeightValue(e.target.value)}
                        placeholder="75.0"
                        min="20" max="300" step="0.1"
                        className="border border-slate-200 rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveWeight}
                    disabled={savingWeight || !weightValue}
                    className="bg-blue-500 text-white rounded-xl px-4 py-2 font-semibold w-full text-sm disabled:opacity-60"
                  >
                    {savingWeight ? "Wird gespeichert..." : "Speichern"}
                  </button>
                </div>
              )}

              <LineChart data={bodyLine} color="#3B82F6" unit=" kg" />

              {bodyLog.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                  <span>Niedrigste: <strong className="text-slate-700">{Math.min(...bodyLog.map(b => b.weight_kg))} kg</strong></span>
                  <span>Höchste: <strong className="text-slate-700">{Math.max(...bodyLog.map(b => b.weight_kg))} kg</strong></span>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

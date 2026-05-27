"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db/init";
import Spinner from "@/components/Spinner";
import MuscleChips, { parseMuscles } from "@/components/MuscleChips";

const DAY_NAMES: Record<number, string> = {
  1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag",
  5: "Freitag", 6: "Samstag", 7: "Sonntag",
};
const DAY_SHORT: Record<number, string> = {
  1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So",
};

interface WorkoutDay {
  id: number;
  day_of_week: number;
  day_mask: string | null;
  name: string;
  focus: string | null;
  exercise_count: number;
  muscle_groups: string | null;
}

interface Plan {
  id: number;
  name: string;
  is_active: number;
}

function parseMask(day: WorkoutDay): number[] {
  const mask = day.day_mask ?? String(day.day_of_week);
  return mask.split(",").map(Number).filter(Boolean);
}

export default function PlanDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const planId = Number(id);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [planName, setPlanName] = useState("");
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDayMask, setNewDayMask] = useState<number[]>([]);
  const [newDayName, setNewDayName] = useState("");
  const [newDayFocus, setNewDayFocus] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const db = await getDb();
    const p = await db.getFirstAsync<Plan>("SELECT * FROM workout_plan WHERE id = ?", [planId]);
    if (!p) { router.replace("/training/plans"); return; }
    setPlan(p);
    setPlanName(p.name);
    const d = await db.getAllAsync<WorkoutDay>(`
      SELECT wd.id, wd.day_of_week, wd.day_mask, wd.name, wd.focus,
             COUNT(e.id) AS exercise_count,
             GROUP_CONCAT(DISTINCT e.muscle_group) AS muscle_groups
      FROM workout_day wd
      LEFT JOIN exercise e ON e.workout_day_id = wd.id
      WHERE wd.plan_id = ?
      GROUP BY wd.id
      ORDER BY wd.day_of_week
    `, [planId]);
    setDays(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, [planId]);

  const handleSaveName = async () => {
    if (!planName.trim()) return;
    const db = await getDb();
    await db.runAsync("UPDATE workout_plan SET name = ? WHERE id = ?", [planName.trim(), planId]);
    setPlan(p => p ? { ...p, name: planName.trim() } : p);
    setEditingName(false);
  };

  const handleAddDay = async () => {
    if (!newDayName.trim() || newDayMask.length === 0) return;
    setAdding(true);
    const db = await getDb();
    const primaryDay = newDayMask[0];
    const maskStr = newDayMask.sort((a, b) => a - b).join(",");
    const { lastInsertRowId } = await db.runAsync(
      "INSERT INTO workout_day (plan_id, day_of_week, day_mask, name, focus) VALUES (?, ?, ?, ?, ?)",
      [planId, primaryDay, maskStr, newDayName.trim(), newDayFocus.trim() || null]
    );
    setShowAddDay(false);
    setNewDayName("");
    setNewDayFocus("");
    setNewDayMask([]);
    setAdding(false);
    await load();
    router.push(`/training/plans/${planId}/day/${lastInsertRowId}`);
  };

  const handleDeleteDay = async (dayId: number, dayName: string) => {
    if (!window.confirm(`"${dayName}" löschen? Alle Übungen dieses Tages werden entfernt.`)) return;
    const db = await getDb();
    await db.runAsync("DELETE FROM workout_day WHERE id = ?", [dayId]);
    await load();
  };

  const toggleDay = (d: number) => {
    setNewDayMask(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

  useEffect(() => {
    if (showAddDay && newDayMask.length === 0) {
      const usedDays = days.flatMap(d => parseMask(d));
      const free = [1,2,3,4,5,6,7].find(d => !usedDays.includes(d));
      if (free) setNewDayMask([free]);
    }
  }, [showAddDay]);

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        {editingName ? (
          <input
            value={planName}
            onChange={e => setPlanName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={e => e.key === "Enter" && handleSaveName()}
            autoFocus
            className="flex-1 text-lg font-bold text-slate-800 border-b-2 border-blue-500 outline-none bg-transparent"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex-1 text-left text-lg font-bold text-slate-800 flex items-center gap-2"
          >
            {plan?.name}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {plan?.is_active ? (
          <span className="text-xs font-semibold bg-blue-100 text-blue-600 px-2 py-1 rounded-full flex-shrink-0">Aktiv</span>
        ) : null}
      </div>

      <div className="px-4 pt-4 pb-8 space-y-3 max-w-md mx-auto">
        {days.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-slate-400 text-sm mb-4">Noch keine Trainingstage geplant.</p>
          </div>
        ) : (
          days.map(day => {
            const dayNums = parseMask(day);
            return (
              <div key={day.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="flex gap-1 flex-shrink-0">
                    {dayNums.map(d => (
                      <div key={d} className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-xs">{DAY_SHORT[d]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{day.name}</p>
                    <p className="text-xs text-slate-400">
                      {dayNums.map(d => DAY_NAMES[d]).join(", ")}
                      {day.focus ? ` · ${day.focus}` : ""}
                      {" · "}{day.exercise_count} {day.exercise_count === 1 ? "Übung" : "Übungen"}
                    </p>
                    <MuscleChips muscles={parseMuscles(day.muscle_groups)} />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDeleteDay(day.id, day.name)}
                      className="text-slate-300 hover:text-red-400 p-1"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                      </svg>
                    </button>
                    <Link
                      href={`/training/plans/${planId}/day/${day.id}`}
                      className="bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 text-xs font-semibold active:opacity-80"
                    >
                      Übungen →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <button
          onClick={() => setShowAddDay(true)}
          className="w-full bg-white rounded-2xl shadow-sm p-4 text-blue-500 font-semibold text-sm border-2 border-dashed border-blue-200 active:opacity-70"
        >
          + Trainingstag hinzufügen
        </button>
      </div>

      {/* Add day modal */}
      {showAddDay && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Trainingstag hinzufügen</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-500 mb-2">Wochentage (mehrere möglich)</label>
                <div className="grid grid-cols-7 gap-1">
                  {[1,2,3,4,5,6,7].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                        newDayMask.includes(d)
                          ? "bg-blue-500 text-white"
                          : "bg-slate-100 text-slate-600 active:bg-slate-200"
                      }`}
                    >
                      {DAY_SHORT[d]}
                    </button>
                  ))}
                </div>
                {newDayMask.length === 0 && (
                  <p className="text-xs text-red-400 mt-1">Mindestens einen Tag auswählen</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Name *</label>
                <input
                  type="text"
                  value={newDayName}
                  onChange={e => setNewDayName(e.target.value)}
                  placeholder="z.B. Push-Tag"
                  autoFocus
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Fokus (optional)</label>
                <input
                  type="text"
                  value={newDayFocus}
                  onChange={e => setNewDayFocus(e.target.value)}
                  placeholder="z.B. Brust & Trizeps"
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowAddDay(false); setNewDayName(""); setNewDayFocus(""); setNewDayMask([]); }}
                className="bg-slate-100 text-slate-700 rounded-xl px-4 py-3 font-semibold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddDay}
                disabled={adding || !newDayName.trim() || newDayMask.length === 0}
                className="bg-blue-500 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50"
              >
                {adding ? "..." : "Hinzufügen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

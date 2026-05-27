"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getDb } from "@/lib/db/init";
import Spinner from "@/components/Spinner";
import ExerciseSearchInput from "@/components/ExerciseSearchInput";
import MuscleChips from "@/components/MuscleChips";

const DAY_NAMES: Record<number, string> = {
  1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag",
  5: "Freitag", 6: "Samstag", 7: "Sonntag",
};

interface Exercise {
  id: number;
  name: string;
  muscle_group: string | null;
  sort_order: number;
  default_sets: number;
  default_reps: number;
  default_weight_kg: number;
  default_rest_sec: number;
  notes: string | null;
}

interface WorkoutDay {
  id: number;
  plan_id: number;
  day_of_week: number;
  name: string;
  focus: string | null;
}

// Inline editable exercise row
function ExerciseRow({
  ex,
  onUpdate,
  onDelete,
}: {
  ex: Exercise;
  onUpdate: (id: number, field: string, value: string | number) => void;
  onDelete: (id: number, name: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <input
            type="text"
            defaultValue={ex.name}
            onBlur={e => onUpdate(ex.id, "name", e.target.value)}
            className="font-semibold text-slate-800 w-full border-b border-transparent focus:border-blue-400 outline-none bg-transparent"
          />
          <input
            type="text"
            defaultValue={ex.muscle_group ?? ""}
            onBlur={e => onUpdate(ex.id, "muscle_group", e.target.value)}
            placeholder="Muskelgruppe (optional)"
            className="text-xs text-slate-400 w-full border-b border-transparent focus:border-blue-300 outline-none bg-transparent"
          />
        </div>
        <button
          onClick={() => onDelete(ex.id, ex.name)}
          className="text-slate-300 hover:text-red-400 flex-shrink-0 pt-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Sätze", field: "default_sets", value: ex.default_sets, step: 1, min: 1 },
          { label: "Wdh.", field: "default_reps", value: ex.default_reps, step: 1, min: 1 },
          { label: "kg", field: "default_weight_kg", value: ex.default_weight_kg, step: 0.5, min: 0 },
          { label: "Pause s", field: "default_rest_sec", value: ex.default_rest_sec, step: 5, min: 0 },
        ].map(({ label, field, value, step, min }) => (
          <div key={field} className="flex flex-col items-center gap-1">
            <span className="text-xs text-slate-400">{label}</span>
            <input
              type="number"
              defaultValue={value}
              step={step}
              min={min}
              onBlur={e => onUpdate(ex.id, field, parseFloat(e.target.value) || 0)}
              className="w-full border border-slate-200 rounded-lg px-1 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DayDetailPage() {
  const router = useRouter();
  const { id, dayId } = useParams<{ id: string; dayId: string }>();
  const planId = Number(id);
  const wdId = Number(dayId);

  const [day, setDay] = useState<WorkoutDay | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Add exercise form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState("");
  const [newSets, setNewSets] = useState("3");
  const [newReps, setNewReps] = useState("10");
  const [newWeight, setNewWeight] = useState("0");
  const [newRest, setNewRest] = useState("90");
  const [adding, setAdding] = useState(false);

  // Day name/focus editing
  const [editDay, setEditDay] = useState(false);
  const [dayName, setDayName] = useState("");
  const [dayFocus, setDayFocus] = useState("");

  const load = async () => {
    const db = await getDb();
    const d = await db.getFirstAsync<WorkoutDay>("SELECT * FROM workout_day WHERE id = ?", [wdId]);
    if (!d) { router.replace(`/training/plans/${planId}`); return; }
    setDay(d);
    setDayName(d.name);
    setDayFocus(d.focus ?? "");
    const exs = await db.getAllAsync<Exercise>(
      "SELECT * FROM exercise WHERE workout_day_id = ? ORDER BY sort_order, id",
      [wdId]
    );
    setExercises(exs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [wdId]);

  const handleSaveDay = async () => {
    const db = await getDb();
    await db.runAsync(
      "UPDATE workout_day SET name = ?, focus = ? WHERE id = ?",
      [dayName.trim() || day!.name, dayFocus.trim() || null, wdId]
    );
    setDay(d => d ? { ...d, name: dayName.trim() || d.name, focus: dayFocus.trim() || null } : d);
    setEditDay(false);
  };

  const handleAddExercise = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO exercise
         (workout_day_id, name, muscle_group, sort_order, default_sets, default_reps, default_weight_kg, default_rest_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wdId, name,
        newMuscle.trim() || null,
        exercises.length,
        parseInt(newSets) || 3,
        parseInt(newReps) || 10,
        parseFloat(newWeight) || 0,
        parseInt(newRest) || 90,
      ]
    );
    setNewName(""); setNewMuscle(""); setNewSets("3"); setNewReps("10"); setNewWeight("0"); setNewRest("90");
    setShowAdd(false);
    setAdding(false);
    await load();
  };

  const handleUpdate = useCallback(async (exId: number, field: string, value: string | number) => {
    const db = await getDb();
    await db.runAsync(`UPDATE exercise SET ${field} = ? WHERE id = ?`, [value, exId]);
    setExercises(exs => exs.map(e => e.id === exId ? { ...e, [field]: value } : e));
  }, []);

  const handleDelete = useCallback(async (exId: number, name: string) => {
    if (!window.confirm(`"${name}" aus diesem Tag entfernen?`)) return;
    const db = await getDb();
    await db.runAsync("DELETE FROM exercise WHERE id = ?", [exId]);
    setExercises(exs => exs.filter(e => e.id !== exId));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="flex-1">
            {editDay ? (
              <div className="space-y-1">
                <input
                  value={dayName}
                  onChange={e => setDayName(e.target.value)}
                  className="font-bold text-slate-800 w-full border-b-2 border-blue-500 outline-none bg-transparent text-base"
                  placeholder="Tag-Name"
                />
                <input
                  value={dayFocus}
                  onChange={e => setDayFocus(e.target.value)}
                  className="text-xs text-slate-400 w-full border-b border-blue-300 outline-none bg-transparent"
                  placeholder="Fokus (z.B. Brust & Trizeps)"
                />
              </div>
            ) : (
              <button onClick={() => setEditDay(true)} className="text-left w-full">
                <p className="font-bold text-slate-800 flex items-center gap-1">
                  {day?.name}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </p>
                <p className="text-xs text-slate-400">
                  {DAY_NAMES[day?.day_of_week ?? 1]}
                  {day?.focus ? ` · ${day.focus}` : ""}
                </p>
                <MuscleChips muscles={[...new Set(exercises.map(e => e.muscle_group).filter((m): m is string => !!m))]} />
              </button>
            )}
          </div>
          {editDay ? (
            <button onClick={handleSaveDay} className="text-blue-500 font-semibold text-sm">
              Speichern
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-3 max-w-md mx-auto">
        {exercises.length === 0 && !showAdd && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-slate-400 text-sm">Noch keine Übungen. Füge deine erste Übung hinzu.</p>
          </div>
        )}

        {exercises.map(ex => (
          <ExerciseRow key={ex.id} ex={ex} onUpdate={handleUpdate} onDelete={handleDelete} />
        ))}

        {/* Add exercise form */}
        {showAdd ? (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h3 className="font-semibold text-slate-700">Neue Übung</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Übungsname *</label>
              <ExerciseSearchInput
                value={newName}
                onChange={setNewName}
                onMuscleSelect={setNewMuscle}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Muskelgruppe (optional)</label>
              <input
                type="text"
                value={newMuscle}
                onChange={e => setNewMuscle(e.target.value)}
                placeholder="z.B. Brust"
                className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Sätze", val: newSets, set: setNewSets },
                { label: "Wdh.", val: newReps, set: setNewReps },
                { label: "kg", val: newWeight, set: setNewWeight },
                { label: "Pause s", val: newRest, set: setNewRest },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-slate-400">{label}</span>
                  <input
                    type="number"
                    value={val}
                    onChange={e => set(e.target.value)}
                    min="0"
                    step={label === "kg" ? "0.5" : "1"}
                    className="w-full border border-slate-200 rounded-lg px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowAdd(false); setNewName(""); }}
                className="bg-slate-100 text-slate-700 rounded-xl px-4 py-2.5 font-semibold text-sm"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddExercise}
                disabled={adding || !newName.trim()}
                className="bg-blue-500 text-white rounded-xl px-4 py-2.5 font-semibold text-sm disabled:opacity-50"
              >
                {adding ? "..." : "Hinzufügen"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full bg-white rounded-2xl shadow-sm p-4 text-blue-500 font-semibold text-sm border-2 border-dashed border-blue-200 active:opacity-70"
          >
            + Übung hinzufügen
          </button>
        )}
      </div>
    </div>
  );
}

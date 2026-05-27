"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/sessionStore";
import type { LoggedSet, SessionExercise } from "@/store/sessionStore";
import Spinner from "@/components/Spinner";

function formatDuration(startedAt: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Editable set row with pre-filled values and blur-to-save
function SetRow({
  s,
  onUpdate,
  onComplete,
}: {
  s: LoggedSet;
  onUpdate: (id: number, data: { weight_kg?: number; reps_done?: number | null }) => void;
  onComplete: (id: number) => void;
}) {
  const [weight, setWeight] = useState(s.weight_kg > 0 ? String(s.weight_kg) : "");
  const [reps, setReps] = useState(
    s.reps_done != null ? String(s.reps_done) : s.reps_target != null ? String(s.reps_target) : ""
  );

  // Sync when this set row is first mounted (new set with pre-filled values)
  useEffect(() => {
    setWeight(s.weight_kg > 0 ? String(s.weight_kg) : "");
    setReps(s.reps_done != null ? String(s.reps_done) : s.reps_target != null ? String(s.reps_target) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.id]);

  const done = !!s.completed;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${done ? "bg-green-50" : "bg-slate-50"}`}>
      <span className="text-xs font-semibold text-slate-400 w-5 text-center flex-shrink-0">
        {s.set_number}
      </span>

      <input
        type="number"
        inputMode="decimal"
        value={weight}
        onChange={e => setWeight(e.target.value)}
        onBlur={() => onUpdate(s.id, { weight_kg: parseFloat(weight) || 0 })}
        placeholder="0"
        min="0"
        step="0.5"
        disabled={done}
        className={`w-20 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          done ? "border-transparent bg-transparent text-slate-400" : "border-slate-200 bg-white"
        }`}
      />
      <span className="text-xs text-slate-400 flex-shrink-0">kg</span>

      <span className="text-slate-300 flex-shrink-0">×</span>

      <input
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={e => setReps(e.target.value)}
        onBlur={() => onUpdate(s.id, { reps_done: parseInt(reps) || null })}
        placeholder="0"
        min="0"
        step="1"
        disabled={done}
        className={`w-16 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          done ? "border-transparent bg-transparent text-slate-400" : "border-slate-200 bg-white"
        }`}
      />
      <span className="text-xs text-slate-400 flex-shrink-0">Wdh</span>

      <button
        onClick={() => { if (!done) { onUpdate(s.id, { reps_done: parseInt(reps) || null, weight_kg: parseFloat(weight) || 0 }); onComplete(s.id); } }}
        className={`ml-auto w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
          done ? "bg-green-500 border-green-500" : "border-slate-300 active:border-green-400 active:bg-green-50"
        }`}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function SessionPage() {
  const router = useRouter();
  const { sessionId, startedAt, exercises, loading, logSet, updateSet, markSetComplete, cancelSession, finishSession } =
    useSessionStore();

  const [elapsed, setElapsed] = useState("00:00");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Live clock
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(formatDuration(startedAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Redirect if no active session
  useEffect(() => {
    if (!loading && sessionId === null) router.replace("/training");
  }, [sessionId, loading, router]);

  const handleAddExercise = useCallback(async () => {
    const name = newExerciseName.trim();
    if (!name) return;
    await logSet(0, name, { set_number: 1, weight_kg: 0, reps_target: 10 });
    setNewExerciseName("");
  }, [newExerciseName, logSet]);

  const handleAddSet = useCallback(async (ex: SessionExercise) => {
    const last = ex.sets[ex.sets.length - 1];
    await logSet(ex.exercise_id, ex.exercise_name, {
      set_number: ex.sets.length + 1,
      weight_kg: last?.weight_kg ?? 0,
      reps_target: last?.reps_done ?? last?.reps_target ?? 10,
      reps_done: last?.reps_done ?? undefined,
    });
  }, [logSet]);

  const handleUpdate = useCallback((id: number, data: { weight_kg?: number; reps_done?: number | null }) => {
    updateSet(id, data);
  }, [updateSet]);

  const handleCancel = async () => {
    setCancelling(true);
    await cancelSession();
    router.replace("/training");
  };

  const handleFinish = async (feedback: number) => {
    setFinishing(true);
    await finishSession(feedback);
    router.replace("/training");
  };

  if (loading || sessionId === null) return <Spinner />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-slate-800">Aktive Session</h1>
          <p className="text-sm text-blue-500 font-mono font-semibold">{elapsed}</p>
        </div>
        <span className="text-sm text-slate-400">{exercises.length} Übung{exercises.length !== 1 ? "en" : ""}</span>
      </div>

      <div className="px-4 pt-4 pb-32 space-y-4">
        {exercises.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-slate-400 text-sm">Noch keine Übungen. Füge unten eine Übung hinzu.</p>
          </div>
        ) : (
          exercises.map(ex => (
            <div key={`${ex.exercise_id}-${ex.exercise_name}`} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="mb-3">
                <h3 className="font-semibold text-slate-800">{ex.exercise_name}</h3>
                {ex.muscle_group && <p className="text-xs text-slate-400">{ex.muscle_group}</p>}
              </div>

              {/* Column headers */}
              {ex.sets.length > 0 && (
                <div className="flex items-center gap-2 px-3 mb-1">
                  <span className="w-5 flex-shrink-0" />
                  <span className="w-20 text-xs text-slate-400 text-center flex-shrink-0">Gewicht</span>
                  <span className="w-4 flex-shrink-0" />
                  <span className="w-4 flex-shrink-0" />
                  <span className="w-16 text-xs text-slate-400 text-center flex-shrink-0">Wdh.</span>
                </div>
              )}

              <div className="space-y-2 mb-3">
                {ex.sets.map(s => (
                  <SetRow
                    key={s.id}
                    s={s}
                    onUpdate={handleUpdate}
                    onComplete={markSetComplete}
                  />
                ))}
              </div>

              <button
                onClick={() => handleAddSet(ex)}
                className="text-blue-500 text-sm font-semibold active:opacity-70"
              >
                + Satz hinzufügen
              </button>
            </div>
          ))
        )}

        {/* Add exercise */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-slate-700 mb-3">Übung hinzufügen</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newExerciseName}
              onChange={e => setNewExerciseName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddExercise()}
              placeholder="Übungsname..."
              className="border border-slate-200 rounded-xl px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddExercise}
              disabled={!newExerciseName.trim()}
              className="bg-blue-500 text-white rounded-xl px-4 py-2 font-bold active:opacity-90 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-20">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
          <button
            onClick={handleCancel}
            disabled={cancelling || finishing}
            className="bg-slate-100 text-slate-700 rounded-xl px-4 py-3 font-semibold active:opacity-90 disabled:opacity-60"
          >
            {cancelling ? "..." : "Abbrechen"}
          </button>
          <button
            onClick={() => setShowFeedback(true)}
            disabled={finishing || cancelling}
            className="bg-blue-500 text-white rounded-xl px-4 py-3 font-semibold active:opacity-90 disabled:opacity-60"
          >
            Training beenden
          </button>
        </div>
      </div>

      {/* Feedback modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-800 text-center">Wie war das Training?</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 1, emoji: "😓", label: "Schwer" },
                { value: 2, emoji: "😊", label: "Gut" },
                { value: 3, emoji: "💪", label: "Super" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleFinish(opt.value)}
                  disabled={finishing}
                  className="flex flex-col items-center gap-1 bg-slate-50 rounded-xl p-4 active:bg-blue-50 disabled:opacity-50"
                >
                  <span className="text-3xl">{opt.emoji}</span>
                  <span className="text-xs font-semibold text-slate-600">{opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowFeedback(false)} className="text-slate-400 text-sm w-full text-center py-1">
              Zurück
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

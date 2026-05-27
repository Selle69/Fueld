"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db/init";
import Spinner from "@/components/Spinner";

interface WorkoutPlan {
  id: number;
  name: string;
  is_active: number;
  day_count: number;
}

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<WorkoutPlan>(`
      SELECT wp.id, wp.name, wp.is_active,
             COUNT(wd.id) AS day_count
      FROM workout_plan wp
      LEFT JOIN workout_day wd ON wd.plan_id = wp.id
      WHERE wp.profile_id = 1
      GROUP BY wp.id
      ORDER BY wp.is_active DESC, wp.created_at DESC
    `);
    setPlans(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const db = await getDb();
    const isFirst = plans.length === 0 ? 1 : 0;
    const { lastInsertRowId } = await db.runAsync(
      "INSERT INTO workout_plan (profile_id, name, is_active) VALUES (1, ?, ?)",
      [name, isFirst]
    );
    setNewName("");
    setShowCreate(false);
    setCreating(false);
    router.push(`/training/plans/${lastInsertRowId}`);
  };

  const handleActivate = async (id: number) => {
    const db = await getDb();
    await db.runAsync("UPDATE workout_plan SET is_active = 0 WHERE profile_id = 1");
    await db.runAsync("UPDATE workout_plan SET is_active = 1 WHERE id = ?", [id]);
    await load();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`"${name}" wirklich löschen? Alle Tage und Übungen werden entfernt.`)) return;
    const db = await getDb();
    await db.runAsync("DELETE FROM workout_plan WHERE id = ?", [id]);
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-800 flex-1">Trainingspläne</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="text-blue-500 font-semibold text-sm active:opacity-70"
        >
          + Neu
        </button>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-3 max-w-md mx-auto">
        {loading ? (
          <Spinner />
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-slate-400 text-sm mb-4">Noch kein Trainingsplan vorhanden.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-blue-500 text-white rounded-xl px-6 py-3 font-semibold active:opacity-90"
            >
              Ersten Plan erstellen
            </button>
          </div>
        ) : (
          plans.map(plan => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl shadow-sm p-4 border-2 ${
                plan.is_active ? "border-blue-400" : "border-transparent"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {!!plan.is_active && (
                    <span className="text-xs font-semibold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      Aktiv
                    </span>
                  )}
                  <span className="font-semibold text-slate-800">{plan.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {!plan.is_active && (
                    <button
                      onClick={() => handleActivate(plan.id)}
                      className="text-xs text-blue-500 font-semibold active:opacity-70"
                    >
                      Aktivieren
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(plan.id, plan.name)}
                    className="text-slate-300 hover:text-red-400 active:opacity-70"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {plan.day_count} {plan.day_count === 1 ? "Trainingstag" : "Trainingstage"}
              </p>
              <Link
                href={`/training/plans/${plan.id}`}
                className="block text-center bg-slate-100 text-slate-700 rounded-xl px-4 py-2 text-sm font-semibold active:opacity-80"
              >
                Plan bearbeiten →
              </Link>
            </div>
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Neuer Trainingsplan</h2>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Planname</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="z.B. Push/Pull/Legs"
                autoFocus
                className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowCreate(false); setNewName(""); }}
                className="bg-slate-100 text-slate-700 rounded-xl px-4 py-3 font-semibold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="bg-blue-500 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50"
              >
                {creating ? "..." : "Erstellen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

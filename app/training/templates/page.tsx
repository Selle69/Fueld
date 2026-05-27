"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db/init";
import Spinner from "@/components/Spinner";

interface WorkoutTemplate {
  id: number;
  name: string;
  focus: string | null;
  exercise_count: number;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFocus, setNewFocus] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<WorkoutTemplate>(`
      SELECT wt.id, wt.name, wt.focus,
             COUNT(te.id) AS exercise_count
      FROM workout_template wt
      LEFT JOIN template_exercise te ON te.template_id = wt.id
      WHERE wt.profile_id = 1
      GROUP BY wt.id
      ORDER BY wt.created_at DESC
    `);
    setTemplates(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const db = await getDb();
    const { lastInsertRowId } = await db.runAsync(
      "INSERT INTO workout_template (profile_id, name, focus) VALUES (1, ?, ?)",
      [name, newFocus.trim() || null]
    );
    setNewName("");
    setNewFocus("");
    setShowCreate(false);
    setCreating(false);
    router.push(`/training/templates/${lastInsertRowId}`);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`"${name}" wirklich löschen?`)) return;
    const db = await getDb();
    await db.runAsync("DELETE FROM workout_template WHERE id = ?", [id]);
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
        <h1 className="text-lg font-bold text-slate-800 flex-1">Freie Trainings</h1>
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
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-slate-400 text-sm mb-4">Noch kein freies Training vorhanden.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-blue-500 text-white rounded-xl px-6 py-3 font-semibold active:opacity-90"
            >
              Erstes Training erstellen
            </button>
          </div>
        ) : (
          templates.map(t => (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                  {t.focus && <p className="text-xs text-slate-400">{t.focus}</p>}
                </div>
                <button
                  onClick={() => handleDelete(t.id, t.name)}
                  className="text-slate-300 hover:text-red-400 active:opacity-70 ml-3 flex-shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {t.exercise_count} {t.exercise_count === 1 ? "Übung" : "Übungen"}
              </p>
              <Link
                href={`/training/templates/${t.id}`}
                className="block text-center bg-slate-100 text-slate-700 rounded-xl px-4 py-2 text-sm font-semibold active:opacity-80"
              >
                Bearbeiten →
              </Link>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Neues freies Training</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                  placeholder="z.B. Oberkörper"
                  autoFocus
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Fokus (optional)</label>
                <input
                  type="text"
                  value={newFocus}
                  onChange={e => setNewFocus(e.target.value)}
                  placeholder="z.B. Brust & Schultern"
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowCreate(false); setNewName(""); setNewFocus(""); }}
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

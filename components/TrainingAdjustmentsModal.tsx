"use client";

import { useState } from "react";
import { useAdjustmentsStore, type Adjustment, type AdjustableField } from "@/store/adjustmentsStore";
import { getDb } from "@/lib/db/init";

const FIELD_LABELS: Record<AdjustableField, { label: string; unit: string }> = {
  default_sets:      { label: "Sätze",          unit: "" },
  default_reps:      { label: "Wiederholungen",  unit: "" },
  default_weight_kg: { label: "Gewicht",         unit: " kg" },
  default_rest_sec:  { label: "Pause",           unit: " s" },
};

function fmtVal(field: AdjustableField, val: number): string {
  const { unit } = FIELD_LABELS[field];
  return `${val}${unit}`;
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={up ? "#10B981" : "#F97316"} strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points={up ? "6 11 12 5 18 11" : "6 13 12 19 18 13"} />
    </svg>
  );
}

export default function TrainingAdjustmentsModal() {
  const { date, adjustments, clear } = useAdjustmentsStore();
  const today = new Date().toISOString().split("T")[0];

  const [accepted, setAccepted] = useState<Set<number>>(() => new Set(adjustments.map((_, i) => i)));
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);

  if (!date || date !== today || adjustments.length === 0 || done) return null;

  const toggle = (i: number) =>
    setAccepted(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const applyChanges = async () => {
    setApplying(true);
    try {
      const db = await getDb();
      for (const [i, adj] of adjustments.entries()) {
        if (!accepted.has(i)) continue;
        await db.runAsync(
          `UPDATE exercise SET ${adj.field} = ? WHERE id = ?`,
          [adj.suggested_value, adj.exercise_id],
        );
      }
    } finally {
      setApplying(false);
      setDone(true);
      clear();
    }
  };

  const acceptedCount = accepted.size;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 pb-6">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-500 px-5 py-4">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl">💪</span>
            <h2 className="text-base font-bold text-white">Coach empfiehlt Änderungen</h2>
          </div>
          <p className="text-indigo-200 text-xs">Wähle aus, was du für das heutige Training übernehmen möchtest</p>
        </div>

        {/* Adjustment list */}
        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {adjustments.map((adj: Adjustment, i: number) => {
            const { label } = FIELD_LABELS[adj.field];
            const isAccepted = accepted.has(i);
            const goesUp = adj.suggested_value > adj.current_value;

            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                  isAccepted ? "bg-indigo-50" : "bg-white"
                }`}
              >
                {/* Checkbox */}
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  isAccepted ? "bg-indigo-500 border-indigo-500" : "border-slate-300"
                }`}>
                  {isAccepted && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{adj.exercise_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{adj.reason}</p>
                </div>

                {/* Change indicator */}
                <div className="flex-shrink-0 flex items-center gap-1.5 text-sm">
                  <span className="text-slate-400 text-xs">{label}</span>
                  <span className="font-semibold text-slate-600">{fmtVal(adj.field, adj.current_value)}</span>
                  <Arrow up={goesUp} />
                  <span className={`font-bold ${goesUp ? "text-emerald-600" : "text-orange-500"}`}>
                    {fmtVal(adj.field, adj.suggested_value)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex gap-3 border-t border-slate-100">
          <button
            onClick={() => { setDone(true); clear(); }}
            className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 font-semibold text-sm"
          >
            Alle ablehnen
          </button>
          <button
            onClick={applyChanges}
            disabled={applying || acceptedCount === 0}
            className="flex-1 bg-indigo-500 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-40"
          >
            {applying ? "Wird gespeichert…" : `${acceptedCount} übernehmen`}
          </button>
        </div>
      </div>
    </div>
  );
}

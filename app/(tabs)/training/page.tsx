"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionStore } from "@/store/sessionStore";
import { getDb } from "@/lib/db/init";
import Spinner from "@/components/Spinner";

interface SessionRow {
  id: number;
  date: string;
  duration_min: number | null;
  total_volume_kg: number | null;
  feedback: number | null;
}

interface ActivePlan {
  id: number;
  name: string;
}

interface PlanDay {
  id: number;
  day_of_week: number;
  day_mask: string | null;
  name: string;
  focus: string | null;
  exercise_count: number;
}

interface WorkoutTemplate {
  id: number;
  name: string;
  focus: string | null;
  exercise_count: number;
}

const FEEDBACK_EMOJI: Record<number, string> = { 1: "😓", 2: "😊", 3: "💪" };
const DAY_SHORT: Record<number, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };
const DAY_FULL: Record<number, string> = {
  1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag",
  5: "Freitag", 6: "Samstag", 7: "Sonntag",
};

function todayDow(): number {
  return ((new Date().getDay() + 6) % 7) + 1;
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return d; }
}

function dayMaskIncludes(day: PlanDay, dow: number): boolean {
  const mask = day.day_mask ?? String(day.day_of_week);
  return mask.split(",").map(Number).includes(dow);
}

function dayMaskLabel(day: PlanDay): string {
  const mask = day.day_mask ?? String(day.day_of_week);
  const days = mask.split(",").map(Number).filter(Boolean);
  return days.map(d => DAY_SHORT[d]).join(", ");
}

export default function TrainingPage() {
  const router = useRouter();
  const { sessionId, startSession, finishSession, cancelSession } = useSessionStore();

  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [starting, setStarting] = useState<number | "free" | null>(null);
  const [startingTemplate, setStartingTemplate] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const todayDow_ = todayDow();

  const loadData = async () => {
    try {
      const db = await getDb();
      const plan = await db.getFirstAsync<ActivePlan>(
        "SELECT id, name FROM workout_plan WHERE profile_id = 1 AND is_active = 1 LIMIT 1"
      );
      setActivePlan(plan ?? null);

      if (plan) {
        const days = await db.getAllAsync<PlanDay>(`
          SELECT wd.id, wd.day_of_week, wd.day_mask, wd.name, wd.focus,
                 COUNT(e.id) AS exercise_count
          FROM workout_day wd
          LEFT JOIN exercise e ON e.workout_day_id = wd.id
          WHERE wd.plan_id = ?
          GROUP BY wd.id
          ORDER BY wd.day_of_week
        `, [plan.id]);
        setPlanDays(days);
      } else {
        setPlanDays([]);
      }

      const tmpl = await db.getAllAsync<WorkoutTemplate>(`
        SELECT wt.id, wt.name, wt.focus, COUNT(te.id) AS exercise_count
        FROM workout_template wt
        LEFT JOIN template_exercise te ON te.template_id = wt.id
        WHERE wt.profile_id = 1
        GROUP BY wt.id
        ORDER BY wt.created_at DESC
      `);
      setTemplates(tmpl);

      const sessions = await db.getAllAsync<SessionRow>(
        `SELECT id, date, duration_min, total_volume_kg, feedback
         FROM training_session
         WHERE profile_id = 1 AND finished_at IS NOT NULL
         ORDER BY date DESC LIMIT 5`
      );
      setRecentSessions(sessions);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleStart = async (workoutDayId?: number) => {
    setStarting(workoutDayId ?? "free");
    try {
      await startSession(1, workoutDayId);
      router.push("/training/session");
    } catch { setStarting(null); }
  };

  const handleStartTemplate = async (templateId: number) => {
    setStartingTemplate(templateId);
    try {
      await startSession(1, undefined, templateId);
      router.push("/training/session");
    } catch { setStartingTemplate(null); }
  };

  const handleFinish = async (feedback: number) => {
    setFinishing(true);
    await finishSession(feedback);
    setShowFeedback(false);
    setFinishing(false);
    await loadData();
  };

  const handleCancel = async () => {
    setCancelling(true);
    await cancelSession();
    setCancelling(false);
  };

  const todayDay = planDays.find(d => dayMaskIncludes(d, todayDow_));
  const otherDays = planDays.filter(d => !dayMaskIncludes(d, todayDow_));

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Training</h1>
        <Link href="/training/plans" className="text-sm text-blue-500 font-semibold active:opacity-70">
          Pläne verwalten →
        </Link>
      </div>

      {/* Active session banner */}
      {sessionId && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-700">Aktive Session</p>
              <p className="text-sm text-blue-500">Training läuft gerade</p>
            </div>
            <Link href="/training/session" className="bg-blue-500 text-white rounded-xl px-4 py-2 font-semibold text-sm">
              Weiter →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCancel}
              disabled={cancelling || finishing}
              className="bg-white text-slate-600 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {cancelling ? "..." : "Abbrechen"}
            </button>
            <button
              onClick={() => setShowFeedback(true)}
              disabled={finishing || cancelling}
              className="bg-blue-500 text-white rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Training beenden
            </button>
          </div>
        </div>
      )}

      {/* Plan section */}
      {loadingData ? (
        <Spinner />
      ) : activePlan ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">Aktiver Plan</p>
            <Link href={`/training/plans/${activePlan.id}`} className="text-xs text-slate-400 active:opacity-70">
              {activePlan.name} →
            </Link>
          </div>

          {todayDay && (
            <div className="bg-blue-500 rounded-2xl p-4 text-white">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-blue-200 font-medium">Heute · {DAY_FULL[todayDow_]}</p>
                  <p className="font-bold text-lg">{todayDay.name}</p>
                  {todayDay.focus && <p className="text-sm text-blue-100">{todayDay.focus}</p>}
                  <p className="text-xs text-blue-200 mt-1">
                    {todayDay.exercise_count} {todayDay.exercise_count === 1 ? "Übung" : "Übungen"}
                  </p>
                </div>
                <button
                  onClick={() => !sessionId && handleStart(todayDay.id)}
                  disabled={!!sessionId || starting === todayDay.id}
                  className="bg-white text-blue-600 rounded-xl px-4 py-2 font-bold text-sm active:opacity-90 disabled:opacity-50 flex-shrink-0"
                >
                  {starting === todayDay.id ? "..." : "Starten"}
                </button>
              </div>
            </div>
          )}

          {otherDays.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-slate-100">
              {otherDays.map(day => (
                <div key={day.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-shrink-0 flex gap-0.5">
                    {(day.day_mask ?? String(day.day_of_week)).split(",").map(Number).filter(Boolean).map(d => (
                      <div key={d} className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-500">{DAY_SHORT[d]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{day.name}</p>
                    <p className="text-xs text-slate-400">
                      {day.focus ? `${day.focus} · ` : ""}{day.exercise_count} Übungen
                    </p>
                  </div>
                  <button
                    onClick={() => !sessionId && handleStart(day.id)}
                    disabled={!!sessionId || starting === day.id}
                    className="text-blue-500 text-sm font-semibold active:opacity-70 disabled:opacity-40 flex-shrink-0"
                  >
                    {starting === day.id ? "..." : "▶"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => !sessionId && handleStart()}
            disabled={!!sessionId || starting === "free"}
            className="w-full bg-slate-100 text-slate-600 rounded-2xl px-4 py-3 font-semibold text-sm active:opacity-80 disabled:opacity-40"
          >
            {starting === "free" ? "..." : "Freie Session starten"}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm text-slate-500">Kein Trainingsplan aktiv. Erstelle einen Plan oder starte eine freie Session.</p>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/training/plans"
              className="bg-blue-500 text-white rounded-xl px-4 py-3 font-semibold text-sm text-center active:opacity-90"
            >
              Plan erstellen
            </Link>
            <button
              onClick={() => !sessionId && handleStart()}
              disabled={!!sessionId || starting === "free"}
              className="bg-slate-100 text-slate-700 rounded-xl px-4 py-3 font-semibold text-sm disabled:opacity-50"
            >
              {starting === "free" ? "..." : "Freie Session"}
            </button>
          </div>
        </div>
      )}

      {/* Free workout templates */}
      {!loadingData && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">Freie Trainings</p>
            <Link href="/training/templates" className="text-xs text-slate-400 active:opacity-70">
              Verwalten →
            </Link>
          </div>
          {templates.length === 0 ? (
            <Link
              href="/training/templates"
              className="block w-full bg-white rounded-2xl shadow-sm p-4 text-blue-500 font-semibold text-sm border-2 border-dashed border-blue-200 text-center active:opacity-70"
            >
              + Freies Training erstellen
            </Link>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-slate-100">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{t.name}</p>
                    <p className="text-xs text-slate-400">
                      {t.focus ? `${t.focus} · ` : ""}{t.exercise_count} Übungen
                    </p>
                  </div>
                  <button
                    onClick={() => !sessionId && handleStartTemplate(t.id)}
                    disabled={!!sessionId || startingTemplate === t.id}
                    className="text-blue-500 text-sm font-semibold active:opacity-70 disabled:opacity-40 flex-shrink-0"
                  >
                    {startingTemplate === t.id ? "..." : "▶"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent sessions */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-3">Letzte Trainings</h2>
        {recentSessions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Noch kein Training absolviert</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{formatDate(s.date)}</p>
                  <p className="text-xs text-slate-400">
                    {s.duration_min != null ? `${s.duration_min} min` : "–"}
                    {s.total_volume_kg != null ? ` · ${Math.round(s.total_volume_kg)} kg` : ""}
                  </p>
                </div>
                <span className="text-xl">{s.feedback ? (FEEDBACK_EMOJI[s.feedback] ?? "–") : "–"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-800 text-center">Wie war das Training?</h2>
            <div className="grid grid-cols-3 gap-3">
              {[{ value: 1, emoji: "😓", label: "Schwer" }, { value: 2, emoji: "😊", label: "Gut" }, { value: 3, emoji: "💪", label: "Super" }].map(opt => (
                <button key={opt.value} onClick={() => handleFinish(opt.value)} disabled={finishing}
                  className="flex flex-col items-center gap-1 bg-slate-50 rounded-xl p-4 active:bg-blue-50 disabled:opacity-50">
                  <span className="text-3xl">{opt.emoji}</span>
                  <span className="text-xs font-semibold text-slate-600">{opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowFeedback(false)} className="text-slate-400 text-sm w-full text-center">Zurück</button>
          </div>
        </div>
      )}
    </div>
  );
}

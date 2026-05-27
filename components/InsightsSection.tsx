"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildInsightStats } from "@/lib/buildInsightStats";
import { useProfileStore } from "@/store/profileStore";
import { useAdjustmentsStore, type Adjustment } from "@/store/adjustmentsStore";

export interface Insight {
  type: "warning" | "tip" | "positive" | "training_adjustment";
  icon: string;
  title: string;
  message: string;
  action?: string | null;
  adjustments?: Adjustment[];
}

const CACHE_KEY = "coach_insights_v2";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

const ACTION_ROUTES: Record<string, string> = {
  schlaf: "/sleep",
  sleep: "/sleep",
  training: "/training",
  ernährung: "/nutrition",
  ernaehrung: "/nutrition",
  nutrition: "/nutrition",
  fortschritt: "/progress",
  progress: "/progress",
};

function resolveRoute(action: string): string | null {
  const lower = action.toLowerCase();
  for (const [key, route] of Object.entries(ACTION_ROUTES)) {
    if (lower.includes(key)) return route;
  }
  return null;
}

function InsightCard({ insight, onAction }: { insight: Insight; onAction: (action: string, ins: Insight) => void }) {
  const borderColor = {
    warning: "border-l-amber-400",
    tip: "border-l-blue-400",
    positive: "border-l-emerald-400",
    training_adjustment: "border-l-indigo-400",
  }[insight.type];

  const badgeColor = {
    warning: "bg-amber-100 text-amber-700",
    tip: "bg-blue-100 text-blue-700",
    positive: "bg-emerald-100 text-emerald-700",
    training_adjustment: "bg-indigo-100 text-indigo-700",
  }[insight.type];

  const badgeLabel = {
    warning: "Achtung",
    tip: "Tipp",
    positive: "Super",
    training_adjustment: "Coach",
  }[insight.type];

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 ${borderColor}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">{insight.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor}`}>
              {badgeLabel}
            </span>
            <p className="text-sm font-bold text-slate-800 leading-tight">{insight.title}</p>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{insight.message}</p>
          {insight.action && (
            <button
              onClick={() => onAction(insight.action!, insight)}
              className="mt-2.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg active:bg-indigo-100"
            >
              {insight.action} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InsightsSection() {
  const { profile } = useProfileStore();
  const router = useRouter();
  const setAdjustments = useAdjustmentsStore(s => s.set);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const loadFromCache = (): { insights: Insight[]; ts: number } | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts < CACHE_TTL && Array.isArray(parsed.insights)) {
        return parsed;
      }
    } catch { /* ignore */ }
    return null;
  };

  const generate = async (force = false) => {
    if (!force) {
      const cached = loadFromCache();
      if (cached) {
        setInsights(cached.insights);
        setLastUpdated(cached.ts);
        setStatus("idle");
        return;
      }
    }

    setStatus("loading");
    try {
      const stats = await buildInsightStats(profile);
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error ?? `HTTP ${res.status}`);
      }

      const data: Insight[] = await res.json();
      const ts = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ insights: data, ts }));
      setInsights(data);
      setLastUpdated(ts);
      setStatus("idle");
    } catch (e) {
      console.error("Insights error:", e);
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  useEffect(() => {
    if (profile) generate();
  }, [profile]);

  const handleAction = (action: string, insight?: Insight) => {
    if (insight?.type === "training_adjustment" && insight.adjustments?.length) {
      const today = new Date().toISOString().split("T")[0];
      const dayId = (insight as unknown as { workout_day_id?: number }).workout_day_id ?? 0;
      setAdjustments(today, dayId, insight.adjustments);
      router.push("/training");
      return;
    }
    const route = resolveRoute(action);
    if (route) router.push(route);
  };

  const fmtAge = (ts: number): string => {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 2) return "gerade eben";
    if (mins < 60) return `vor ${mins} Min.`;
    return `vor ${Math.round(mins / 60)} h`;
  };

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-2"
        >
          <span className="text-base font-bold text-slate-800">Coach-Empfehlungen</span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"
            className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {lastUpdated && !collapsed && (
            <span className="text-xs text-slate-400">{fmtAge(lastUpdated)}</span>
          )}
          <button
            onClick={() => generate(true)}
            disabled={status === "loading"}
            className="text-xs text-indigo-500 font-semibold disabled:opacity-40 flex items-center gap-1"
          >
            {status === "loading" ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-.08-4" />
              </svg>
            )}
            Aktualisieren
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {status === "loading" && insights.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-3">
              <svg className="animate-spin text-indigo-400 flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-700">Coach analysiert deine Daten…</p>
                <p className="text-xs text-slate-400">Schlaf, Training & Ernährung werden ausgewertet</p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="bg-white rounded-2xl shadow-sm p-4 border border-red-100 space-y-1">
              <p className="text-sm font-semibold text-red-600">Coach nicht erreichbar</p>
              {errorMsg && (
                <p className="text-xs text-slate-400 font-mono break-all">{errorMsg}</p>
              )}
              <button
                onClick={() => generate(true)}
                className="mt-1 text-xs text-indigo-500 font-semibold"
              >
                Nochmal versuchen
              </button>
            </div>
          )}

          {insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} onAction={(a, insight) => handleAction(a, insight)} />
          ))}
        </>
      )}
    </div>
  );
}

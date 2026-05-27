"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useProfileStore } from "@/store/profileStore";
import { useTodayStore } from "@/store/todayStore";
import MacroBar from "@/components/MacroBar";
import Spinner from "@/components/Spinner";
import InfoTooltip from "@/components/InfoTooltip";
import InsightsSection from "@/components/InsightsSection";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
  pre_workout: "Pre-Workout",
  post_workout: "Post-Workout",
};

function getGermanDate(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const { profile, loading: profileLoading, load } = useProfileStore();
  const { meals, summary, loading: todayLoading, loadToday } = useTodayStore();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (profile) {
      loadToday(1);
    }
  }, [profile, loadToday]);

  if (profileLoading || (profile && todayLoading)) {
    return <Spinner />;
  }

  const kcalTarget = profile?.daily_kcal_target ?? 2000;
  const proteinTarget = profile?.protein_target_g ?? 150;
  const carbsTarget = profile?.carbs_target_g ?? 200;
  const fatTarget = profile?.fat_target_g ?? 60;

  const currentKcal = summary?.total_kcal ?? 0;
  const currentProtein = summary?.total_protein_g ?? 0;
  const currentCarbs = summary?.total_carbs_g ?? 0;
  const currentFat = summary?.total_fat_g ?? 0;

  const lastThreeMeals = meals.slice(-3).reverse();

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Hey {profile?.name ?? ""}!</h1>
        <p className="text-sm text-slate-500">{getGermanDate()}</p>
      </div>

      {/* Macro Progress */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-slate-800 flex items-center">
          Heutige Makros
          <InfoTooltip text="Deine Tagesziele wurden beim Onboarding per Mifflin-St.-Jeor-Formel berechnet – basierend auf Größe, Gewicht, Alter, Geschlecht, Aktivitätslevel und deinem Ziel (Abnehmen / Aufbauen / Halten)." />
        </h2>
        <MacroBar label="Kalorien" value={currentKcal} target={kcalTarget} unit="kcal" color="#3B82F6" />
        <MacroBar label="Protein" value={currentProtein} target={proteinTarget} unit="g" color="#10B981" />
        <MacroBar label="Kohlenhydrate" value={currentCarbs} target={carbsTarget} unit="g" color="#F59E0B" />
        <MacroBar label="Fett" value={currentFat} target={fatTarget} unit="g" color="#EF4444" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/nutrition/add"
          className="bg-blue-500 text-white rounded-xl px-4 py-3 font-semibold text-center active:opacity-90"
        >
          Mahlzeit erfassen
        </Link>
        <Link
          href="/training"
          className="bg-slate-100 text-slate-700 rounded-xl px-4 py-3 font-semibold text-center active:opacity-90"
        >
          Training starten
        </Link>
      </div>

      {/* Training Status */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-2">Training heute</h2>
        {summary?.trained ? (
          <div className="flex items-center gap-2 text-green-600">
            <span className="text-lg">✓</span>
            <span className="font-semibold">Trainiert heute</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Noch kein Training heute</p>
        )}
      </div>

      {/* Last Meals */}
      {lastThreeMeals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Letzte Mahlzeiten</h2>
          <div className="space-y-2">
            {lastThreeMeals.map(meal => (
              <div key={meal.id} className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{meal.name}</p>
                  <p className="text-xs text-slate-400">
                    {MEAL_TYPE_LABELS[meal.meal_type] ?? meal.meal_type} · {meal.quantity_g} g
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-600">{Math.round(meal.kcal)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Coach */}
      <InsightsSection />
    </div>
  );
}

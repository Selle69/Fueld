"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useProfileStore } from "@/store/profileStore";
import { useTodayStore } from "@/store/todayStore";
import Spinner from "@/components/Spinner";

const MEAL_TYPE_ORDER = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"];
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

export default function NutritionPage() {
  const { profile, load } = useProfileStore();
  const { meals, summary, loading, loadToday, deleteMeal } = useTodayStore();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (profile) {
      loadToday(1);
    }
  }, [profile, loadToday]);

  if (loading) {
    return <Spinner />;
  }

  const kcalTarget = profile?.daily_kcal_target ?? 2000;
  const proteinTarget = profile?.protein_target_g ?? 150;
  const carbsTarget = profile?.carbs_target_g ?? 200;
  const fatTarget = profile?.fat_target_g ?? 60;

  // Group meals by meal_type
  const mealsByType: Record<string, typeof meals> = {};
  for (const meal of meals) {
    if (!mealsByType[meal.meal_type]) mealsByType[meal.meal_type] = [];
    mealsByType[meal.meal_type].push(meal);
  }

  const orderedTypes = MEAL_TYPE_ORDER.filter(t => mealsByType[t] && mealsByType[t].length > 0);

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">
      {/* Date Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Ernährung</h1>
        <p className="text-sm text-slate-500">{getGermanDate()}</p>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-3">Heutige Zufuhr</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Kalorien</p>
            <p className="font-bold text-slate-800">{Math.round(summary?.total_kcal ?? 0)}</p>
            <p className="text-xs text-slate-400">Ziel: {kcalTarget} kcal</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Protein</p>
            <p className="font-bold text-slate-800">{Math.round(summary?.total_protein_g ?? 0)} g</p>
            <p className="text-xs text-slate-400">Ziel: {proteinTarget} g</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Kohlenhydrate</p>
            <p className="font-bold text-slate-800">{Math.round(summary?.total_carbs_g ?? 0)} g</p>
            <p className="text-xs text-slate-400">Ziel: {carbsTarget} g</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Fett</p>
            <p className="font-bold text-slate-800">{Math.round(summary?.total_fat_g ?? 0)} g</p>
            <p className="text-xs text-slate-400">Ziel: {fatTarget} g</p>
          </div>
        </div>
      </div>

      {/* Meals by type */}
      {orderedTypes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-slate-400 text-sm">Noch keine Mahlzeiten erfasst</p>
          <p className="text-slate-400 text-xs mt-1">Tippe auf + um eine Mahlzeit hinzuzufügen</p>
        </div>
      ) : (
        orderedTypes.map(type => (
          <div key={type} className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold text-slate-700 mb-2">{MEAL_TYPE_LABELS[type]}</h3>
            <div className="space-y-2">
              {mealsByType[type].map(meal => (
                <div key={meal.id} className="flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{meal.name}</p>
                    <p className="text-xs text-slate-400">{meal.quantity_g} g</p>
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <span className="text-sm font-semibold text-slate-600">{Math.round(meal.kcal)} kcal</span>
                    <button
                      onClick={() => deleteMeal(meal.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors"
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
              ))}
            </div>
          </div>
        ))
      )}

      {/* FAB */}
      <Link
        href="/nutrition/add"
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg active:opacity-90 z-40"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>
    </div>
  );
}

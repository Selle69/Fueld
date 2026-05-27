"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore } from "@/store/profileStore";
import { calculateTargets } from "@/lib/tdee";

const TOTAL_STEPS = 8;

interface OnboardingState {
  name: string;
  gender: string;
  age: string;
  height_cm: string;
  weight_kg: string;
  goal: string;
  training_days_per_week: number;
  experience_level: string;
  equipment: string;
  job_type: string;
  activity_level: string;
  diet_type: string;
  meals_per_day: number;
  avg_sleep_hours: number;
}

const experienceLevels = [
  { value: "beginner", label: "Anfänger" },
  { value: "intermediate", label: "Fortgeschritten" },
  { value: "advanced", label: "Profi" },
];

const equipmentOptions = [
  { value: "bodyweight", label: "Kein Equipment" },
  { value: "home", label: "Heimstudio" },
  { value: "gym", label: "Fitnessstudio" },
];

const jobTypes = [
  { value: "sedentary", label: "Bürojob" },
  { value: "light", label: "Leichte Arbeit" },
  { value: "moderate_active", label: "Aktive Arbeit" },
  { value: "very_active", label: "Sehr aktive Arbeit" },
];

const activityLevels = [
  { value: "sedentary", label: "Wenig aktiv" },
  { value: "light", label: "Leicht aktiv" },
  { value: "moderate", label: "Moderat aktiv" },
  { value: "active", label: "Sehr aktiv" },
];

const dietTypes = [
  { value: "none", label: "Keine Einschränkungen" },
  { value: "vegetarian", label: "Vegetarisch" },
  { value: "vegan", label: "Vegan" },
  { value: "keto", label: "Keto" },
  { value: "paleo", label: "Paleo" },
  { value: "gluten_free", label: "Glutenfrei" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { upsert } = useProfileStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [state, setState] = useState<OnboardingState>({
    name: "",
    gender: "",
    age: "",
    height_cm: "",
    weight_kg: "",
    goal: "",
    training_days_per_week: 3,
    experience_level: "beginner",
    equipment: "gym",
    job_type: "sedentary",
    activity_level: "light",
    diet_type: "none",
    meals_per_day: 3,
    avg_sleep_hours: 7,
  });

  const update = (key: keyof OnboardingState, value: string | number) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  const goNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const handleFinish = async () => {
    setSaving(true);
    try {
      const age = parseInt(state.age) || 25;
      const height_cm = parseFloat(state.height_cm) || 170;
      const weight_kg = parseFloat(state.weight_kg) || 70;

      const targets = calculateTargets({
        gender: state.gender || "male",
        age,
        height_cm,
        weight_kg,
        activity_level: state.activity_level,
        job_type: state.job_type,
        training_days_per_week: state.training_days_per_week,
        goal: state.goal || "stay_fit",
      });

      await upsert({
        name: state.name || "Nutzer",
        gender: state.gender || null,
        age,
        height_cm,
        weight_kg,
        goal: state.goal || "stay_fit",
        training_days_per_week: state.training_days_per_week,
        experience_level: state.experience_level,
        equipment: state.equipment,
        job_type: state.job_type,
        activity_level: state.activity_level,
        diet_type: state.diet_type,
        meals_per_day: state.meals_per_day,
        avg_sleep_hours: state.avg_sleep_hours,
        daily_kcal_target: targets.kcal,
        protein_target_g: targets.protein_g,
        carbs_target_g: targets.carbs_g,
        fat_target_g: targets.fat_g,
      });

      router.replace("/dashboard");
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  // Compute preview targets for summary step
  const previewTargets = (() => {
    try {
      return calculateTargets({
        gender: state.gender || "male",
        age: parseInt(state.age) || 25,
        height_cm: parseFloat(state.height_cm) || 170,
        weight_kg: parseFloat(state.weight_kg) || 70,
        activity_level: state.activity_level,
        job_type: state.job_type,
        training_days_per_week: state.training_days_per_week,
        goal: state.goal || "stay_fit",
      });
    } catch {
      return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    }
  })();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {step > 1 && (
              <button
                onClick={goBack}
                className="text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                <span className="text-sm">Zurück</span>
              </button>
            )}
            {step === 1 && <div />}
            <span className="text-sm text-slate-500">{step} / {TOTAL_STEPS}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          {/* Step 1: Willkommen */}
          {step === 1 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-slate-800">Willkommen bei Fueld!</h1>
              <p className="text-slate-500">Lass uns dein Profil einrichten. Das dauert nur 2 Minuten.</p>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Dein Name</label>
                <input
                  type="text"
                  value={state.name}
                  onChange={e => update("name", e.target.value)}
                  placeholder="Max Mustermann"
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Körper */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Körper</h2>
              <div>
                <label className="block text-sm text-slate-500 mb-2">Geschlecht</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "male", label: "Männlich" },
                    { value: "female", label: "Weiblich" },
                    { value: "diverse", label: "Divers" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update("gender", opt.value)}
                      className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-colors ${
                        state.gender === opt.value
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-slate-100 text-slate-700 border-transparent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Alter</label>
                <input
                  type="number"
                  value={state.age}
                  onChange={e => update("age", e.target.value)}
                  placeholder="25"
                  min="10"
                  max="100"
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Maße */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Deine Maße</h2>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Körpergröße (cm)</label>
                <input
                  type="number"
                  value={state.height_cm}
                  onChange={e => update("height_cm", e.target.value)}
                  placeholder="175"
                  min="100"
                  max="250"
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Körpergewicht (kg)</label>
                <input
                  type="number"
                  value={state.weight_kg}
                  onChange={e => update("weight_kg", e.target.value)}
                  placeholder="75"
                  min="30"
                  max="300"
                  step="0.1"
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 4: Ziel */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Dein Ziel</h2>
              <div className="space-y-3">
                {[
                  { value: "lose_weight", label: "Abnehmen", desc: "Fett verbrennen & schlanker werden", emoji: "🔥" },
                  { value: "build_muscle", label: "Muskeln aufbauen", desc: "Stärker & muskulöser werden", emoji: "💪" },
                  { value: "stay_fit", label: "Fit bleiben", desc: "Gesund & aktiv bleiben", emoji: "⚡" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update("goal", opt.value)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${
                      state.goal === opt.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{opt.emoji}</span>
                      <div>
                        <div className="font-semibold text-slate-800">{opt.label}</div>
                        <div className="text-sm text-slate-500">{opt.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Training */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Training</h2>
              <div>
                <label className="block text-sm text-slate-500 mb-2">
                  Trainingstage pro Woche: <span className="font-semibold text-slate-700">{state.training_days_per_week}</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <button
                      key={d}
                      onClick={() => update("training_days_per_week", d)}
                      className={`w-10 h-10 rounded-xl text-sm font-semibold border transition-colors ${
                        state.training_days_per_week === d
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-slate-100 text-slate-700 border-transparent"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-2">Erfahrungslevel</label>
                <div className="grid grid-cols-3 gap-2">
                  {experienceLevels.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update("experience_level", opt.value)}
                      className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-colors ${
                        state.experience_level === opt.value
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-slate-100 text-slate-700 border-transparent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-2">Equipment</label>
                <div className="grid grid-cols-3 gap-2">
                  {equipmentOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update("equipment", opt.value)}
                      className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-colors ${
                        state.equipment === opt.value
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-slate-100 text-slate-700 border-transparent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Alltag */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Dein Alltag</h2>
              <div>
                <label className="block text-sm text-slate-500 mb-2">Beruf / Tagesaktivität</label>
                <div className="grid grid-cols-2 gap-2">
                  {jobTypes.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update("job_type", opt.value)}
                      className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-colors ${
                        state.job_type === opt.value
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-slate-100 text-slate-700 border-transparent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-2">Freizeitaktivität</label>
                <div className="grid grid-cols-2 gap-2">
                  {activityLevels.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update("activity_level", opt.value)}
                      className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-colors ${
                        state.activity_level === opt.value
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-slate-100 text-slate-700 border-transparent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Ernährung */}
          {step === 7 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Ernährung</h2>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Ernährungsweise</label>
                <select
                  value={state.diet_type}
                  onChange={e => update("diet_type", e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {dietTypes.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-2">Mahlzeiten pro Tag</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      onClick={() => update("meals_per_day", n)}
                      className={`w-10 h-10 rounded-xl text-sm font-semibold border transition-colors ${
                        state.meals_per_day === n
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-slate-100 text-slate-700 border-transparent"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-2">
                  Schlaf pro Nacht: <span className="font-semibold text-slate-700">{state.avg_sleep_hours} Std.</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[5, 6, 7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      onClick={() => update("avg_sleep_hours", n)}
                      className={`w-10 h-10 rounded-xl text-sm font-semibold border transition-colors ${
                        state.avg_sleep_hours === n
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-slate-100 text-slate-700 border-transparent"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 8: Zusammenfassung */}
          {step === 8 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Zusammenfassung</h2>
              <p className="text-slate-500 text-sm">Basierend auf deinen Angaben haben wir folgende Ziele berechnet:</p>

              <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Kalorien</span>
                  <span className="font-semibold text-slate-800">{previewTargets.kcal} kcal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Protein</span>
                  <span className="font-semibold text-slate-800">{previewTargets.protein_g} g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Kohlenhydrate</span>
                  <span className="font-semibold text-slate-800">{previewTargets.carbs_g} g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Fett</span>
                  <span className="font-semibold text-slate-800">{previewTargets.fat_g} g</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Name</span>
                  <span className="font-semibold text-slate-700">{state.name || "Nutzer"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Ziel</span>
                  <span className="font-semibold text-slate-700">
                    {state.goal === "lose_weight" ? "Abnehmen" : state.goal === "build_muscle" ? "Muskeln aufbauen" : "Fit bleiben"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Trainingstage</span>
                  <span className="font-semibold text-slate-700">{state.training_days_per_week}x / Woche</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom button */}
        <div className="mt-6">
          {step < TOTAL_STEPS ? (
            <button
              onClick={goNext}
              className="bg-blue-500 text-white rounded-xl px-4 py-3 font-semibold w-full active:opacity-90"
            >
              Weiter
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="bg-blue-500 text-white rounded-xl px-4 py-3 font-semibold w-full active:opacity-90 disabled:opacity-60"
            >
              {saving ? "Wird gespeichert..." : "Loslegen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

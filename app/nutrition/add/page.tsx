"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTodayStore } from "@/store/todayStore";
import { loadAnalysisSettings, saveAnalysisSettings, ENV_DEFAULTS } from "@/lib/analysisSettings";
import InfoTooltip from "@/components/InfoTooltip";

interface OFFProduct {
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch", label: "Mittagessen" },
  { value: "dinner", label: "Abendessen" },
  { value: "snack", label: "Snack" },
  { value: "pre_workout", label: "Pre-Workout" },
  { value: "post_workout", label: "Post-Workout" },
];

function isoDate(): string {
  return new Date().toISOString().split("T")[0];
}

function calcMacros(per100: Per100, grams: number) {
  const f = (v: number) => String(Math.round(v * grams / 100 * 10) / 10);
  return {
    kcal: String(Math.round(per100.kcal * grams / 100)),
    protein_g: f(per100.protein),
    carbs_g: f(per100.carbs),
    fat_g: f(per100.fat),
  };
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AddMealPage() {
  const router = useRouter();
  const { addMeal } = useTodayStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [name, setName] = useState("");
  const [quantity_g, setQuantity_g] = useState("");
  const [meal_type, setMealType] = useState("snack");
  const [kcal, setKcal] = useState("");
  const [protein_g, setProtein_g] = useState("");
  const [carbs_g, setCarbs_g] = useState("");
  const [fat_g, setFat_g] = useState("");
  const [saving, setSaving] = useState(false);

  // Search state
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [per100, setPer100] = useState<Per100 | null>(null);
  const [offSelected, setOffSelected] = useState(false);

  // Camera / AI state
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalyzed, setAiAnalyzed] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");

  useEffect(() => {
    const s = loadAnalysisSettings();
    if (s) { setApiUrl(s.apiUrl); setApiKey(s.apiKey); setModelName(s.modelName); }
  }, []);

  // Recalculate macros when quantity changes and a product is selected
  useEffect(() => {
    if (!per100) return;
    const q = parseFloat(quantity_g);
    if (!quantity_g || isNaN(q) || q <= 0) return;
    const m = calcMacros(per100, q);
    setKcal(m.kcal);
    setProtein_g(m.protein_g);
    setCarbs_g(m.carbs_g);
    setFat_g(m.fat_g);
  }, [quantity_g, per100]);

  const triggerSearch = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search-food?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setSearchResults(data.products ?? []);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    setOffSelected(false);
    setPer100(null);
    setAiAnalyzed(false);
    triggerSearch(value);
  };

  const handleSelectProduct = (product: OFFProduct) => {
    setName(product.name);
    const p100: Per100 = {
      kcal: product.kcal_100g,
      protein: product.protein_100g,
      carbs: product.carbs_100g,
      fat: product.fat_100g,
    };
    setPer100(p100);
    setOffSelected(true);
    setAiAnalyzed(false);
    setShowResults(false);
    setSearchResults([]);

    const q = parseFloat(quantity_g);
    if (!isNaN(q) && q > 0) {
      const m = calcMacros(p100, q);
      setKcal(m.kcal);
      setProtein_g(m.protein_g);
      setCarbs_g(m.carbs_g);
      setFat_g(m.fat_g);
    }
  };

  const handleSaveSettings = () => {
    if (!apiUrl.trim()) return;
    saveAnalysisSettings({ apiUrl: apiUrl.trim(), apiKey: apiKey.trim(), modelName: modelName.trim() });
    setShowSettings(false);
    requestAnimationFrame(() => fileInputRef.current?.click());
  };

  const handleCameraClick = () => {
    const settings = loadAnalysisSettings();
    if (!settings?.apiUrl) {
      setShowSettings(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const settings = loadAnalysisSettings();
    if (!settings?.apiUrl) { setShowSettings(true); return; }

    setAnalyzing(true);
    setAnalyzeError(null);
    setAiAnalyzed(false);
    setOffSelected(false);
    setPer100(null);

    try {
      const imageBase64 = await compressImage(file);
      const res = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, apiUrl: settings.apiUrl, apiKey: settings.apiKey, modelName: settings.modelName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler bei der Analyse");

      if (data.name) setName(String(data.name));
      if (data.quantity_g) setQuantity_g(String(Math.round(Number(data.quantity_g))));
      if (data.kcal) setKcal(String(Math.round(Number(data.kcal))));
      if (data.protein_g) setProtein_g(String(Math.round(Number(data.protein_g) * 10) / 10));
      if (data.carbs_g) setCarbs_g(String(Math.round(Number(data.carbs_g) * 10) / 10));
      if (data.fat_g) setFat_g(String(Math.round(Number(data.fat_g) * 10) / 10));
      setAiAnalyzed(true);
    } catch (err) {
      setAnalyzeError(String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !quantity_g) return;
    setSaving(true);
    try {
      await addMeal({
        profile_id: 1,
        date: isoDate(),
        meal_type,
        name: name.trim(),
        quantity_g: parseFloat(quantity_g) || 0,
        kcal: parseFloat(kcal) || 0,
        protein_g: parseFloat(protein_g) || 0,
        carbs_g: parseFloat(carbs_g) || 0,
        fat_g: parseFloat(fat_g) || 0,
        fiber_g: null,
        source: offSelected ? "openfoodfacts" : aiAnalyzed ? "camera" : "manual",
        food_cache_id: null,
        photo_path: null,
      });
      router.back();
    } catch {
      setSaving(false);
    }
  };

  const source = offSelected ? "off" : aiAnalyzed ? "ai" : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-800 flex-1">Mahlzeit erfassen</h1>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="text-slate-400 hover:text-slate-600 p-1"
          aria-label="KI-Einstellungen"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <form onSubmit={handleSubmit} className="flex-1">
        <div className="px-4 pt-4 pb-28 space-y-4">

          {/* Name / Search */}
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <div className="relative">
              <label className="block text-sm text-slate-500 mb-1">Lebensmittel *</label>
              <div className="relative">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                  onBlur={() => setTimeout(() => setShowResults(false), 250)}
                  placeholder="z.B. Haferflocken suchen..."
                  required
                  autoComplete="off"
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {searchLoading ? (
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Results dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden max-h-64 overflow-y-auto">
                  {searchResults.map((product, i) => (
                    <button
                      key={i}
                      type="button"
                      onPointerDown={() => handleSelectProduct(product)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 active:bg-blue-100 border-b border-slate-100 last:border-0"
                    >
                      <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                      <p className="text-xs text-slate-400">
                        {product.brand ? `${product.brand} · ` : ""}
                        {product.kcal_100g} kcal · {product.protein_100g}g P · {product.carbs_100g}g K · {product.fat_100g}g F
                        <span className="text-slate-300"> / 100g</span>
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {showResults && !searchLoading && searchResults.length === 0 && name.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-20 px-4 py-3">
                  <p className="text-sm text-slate-400">Keine Ergebnisse gefunden</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Menge in g *</label>
              <input
                type="number"
                value={quantity_g}
                onChange={e => setQuantity_g(e.target.value)}
                placeholder="100"
                required
                min="0"
                step="1"
                className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {per100 && quantity_g && (
                <p className="text-xs text-slate-400 mt-1">
                  Nährwerte werden für {quantity_g} g berechnet
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Mahlzeit</label>
              <select
                value={meal_type}
                onChange={e => setMealType(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {MEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Source badges */}
          {source === "off" && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-sm text-green-700 font-medium">Aus OpenFoodFacts</span>
              <InfoTooltip text="Nährwerte stammen aus der OpenFoodFacts-Datenbank (openfoodfacts.org) – eine offene, gemeinschaftlich gepflegte Lebensmitteldatenbank. Die Angaben basieren auf den Produktinformationen der Hersteller." />
            </div>
          )}

          {source === "ai" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-sm text-blue-700 font-medium">Von KI analysiert</span>
              <InfoTooltip text="Diese Nährwerte wurden automatisch per KI-Bildanalyse geschätzt. Die Genauigkeit hängt vom Foto und dem verwendeten Modell ab. Bitte prüfe und korrigiere die Werte bei Bedarf." />
            </div>
          )}

          {analyzeError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {analyzeError}
            </div>
          )}

          {/* Macros */}
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">Nährwerte</h2>
              {per100 && (
                <span className="text-xs text-green-600 font-medium">
                  Auto-berechnet
                </span>
              )}
            </div>
            {[
              { label: "Kalorien (kcal)", val: kcal, set: setKcal },
              { label: "Protein (g)", val: protein_g, set: setProtein_g },
              { label: "Kohlenhydrate (g)", val: carbs_g, set: setCarbs_g },
              { label: "Fett (g)", val: fat_g, set: setFat_g },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-sm text-slate-500 mb-1">{label}</label>
                <input
                  type="number"
                  value={val}
                  onChange={e => { set(e.target.value); }}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          {/* Camera button */}
          <button
            type="button"
            onClick={handleCameraClick}
            disabled={analyzing}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 active:opacity-80 disabled:opacity-60 border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              {analyzing ? (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-700 text-sm">
                {analyzing ? "Analysiere Foto..." : "Stattdessen fotografieren"}
              </p>
              <p className="text-xs text-slate-400">
                {analyzing ? "KI analysiert das Foto" : "KI schätzt Nährwerte aus dem Bild"}
              </p>
            </div>
          </button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
          <div className="max-w-md mx-auto">
            <button
              type="submit"
              disabled={saving || !name.trim() || !quantity_g}
              className="bg-blue-500 text-white rounded-xl px-4 py-3 font-semibold w-full active:opacity-90 disabled:opacity-60"
            >
              {saving ? "Wird gespeichert..." : "Speichern"}
            </button>
          </div>
        </div>
      </form>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">KI-API konfigurieren</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Kompatibel mit jedem OpenAI-kompatiblen Endpunkt (Ollama, LM Studio, OpenAI, etc.)
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">API-URL *</label>
                <input
                  type="url"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  placeholder={ENV_DEFAULTS.apiUrl || "https://api.example.com/v1/chat/completions"}
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">API-Token (optional)</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Modellname (optional)</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  placeholder={ENV_DEFAULTS.modelName || "z.B. llava, gpt-4o, gemma3"}
                  className="border border-slate-200 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => { saveAnalysisSettings({ apiUrl: apiUrl.trim(), apiKey: apiKey.trim(), modelName: modelName.trim() }); setShowSettings(false); }}
                disabled={!apiUrl.trim()}
                className="bg-slate-100 text-slate-700 rounded-xl px-4 py-3 font-semibold disabled:opacity-50"
              >
                Nur speichern
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={!apiUrl.trim()}
                className="bg-blue-500 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50"
              >
                Speichern & Foto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

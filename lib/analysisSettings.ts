export interface AnalysisSettings {
  apiUrl: string;
  apiKey: string;
  modelName: string;
}

const KEY = "fueld_api_settings";

export const ENV_DEFAULTS: AnalysisSettings = {
  apiUrl: process.env.NEXT_PUBLIC_AI_URL ?? "",
  apiKey: process.env.NEXT_PUBLIC_AI_KEY ?? "",
  modelName: process.env.NEXT_PUBLIC_AI_MODEL ?? "",
};

export function loadAnalysisSettings(): AnalysisSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as AnalysisSettings) : null;
    // Merge: saved values override env defaults; fall back to env if saved is empty
    const merged: AnalysisSettings = {
      apiUrl: saved?.apiUrl || ENV_DEFAULTS.apiUrl,
      apiKey: saved?.apiKey ?? ENV_DEFAULTS.apiKey,
      modelName: saved?.modelName || ENV_DEFAULTS.modelName,
    };
    return merged.apiUrl ? merged : null;
  } catch {
    return ENV_DEFAULTS.apiUrl ? ENV_DEFAULTS : null;
  }
}

export function saveAnalysisSettings(s: AnalysisSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

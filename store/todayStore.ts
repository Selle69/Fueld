import { create } from 'zustand';
import { getDb } from '../lib/db/init';

export interface MealLog {
  id: number;
  profile_id: number;
  date: string;
  meal_type: string;
  name: string;
  quantity_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  source: string;
  food_cache_id: number | null;
  photo_path: string | null;
  created_at: string;
}

export interface DailySummary {
  id: number;
  profile_id: number;
  date: string;
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  kcal_target: number | null;
  trained: 0 | 1;
  training_session_id: number | null;
  training_volume_kg: number | null;
  llm_tip: string | null;
  tip_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MealInput = Omit<MealLog, 'id' | 'created_at'>;

interface TotalsRow {
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

interface TodayState {
  date: string;
  meals: MealLog[];
  summary: DailySummary | null;
  loading: boolean;
  error: string | null;

  setDate: (date: string) => void;
  loadToday: (profileId: number) => Promise<void>;
  addMeal: (meal: MealInput) => Promise<void>;
  deleteMeal: (id: number) => Promise<void>;
  refreshSummary: (profileId: number) => Promise<void>;
  setTrainingDone: (profileId: number, sessionId: number, volumeKg: number) => Promise<void>;
  setLlmTip: (tip: string) => Promise<void>;
}

function isoDate(d: Date = new Date()): string {
  return d.toISOString().split('T')[0];
}

export const useTodayStore = create<TodayState>((set, get) => ({
  date: isoDate(),
  meals: [],
  summary: null,
  loading: false,
  error: null,

  setDate: (date) => set({ date }),

  loadToday: async (profileId) => {
    set({ loading: true, error: null });
    try {
      const db = await getDb();
      const { date } = get();

      const meals = await db.getAllAsync<MealLog>(
        'SELECT * FROM meal_log WHERE profile_id = ? AND date = ? ORDER BY created_at',
        [profileId, date]
      );
      const summary = await db.getFirstAsync<DailySummary>(
        'SELECT * FROM daily_summary WHERE profile_id = ? AND date = ?',
        [profileId, date]
      );

      set({ meals, summary: summary ?? null, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addMeal: async (meal) => {
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const result = await db.runAsync(
        `INSERT INTO meal_log
           (profile_id, date, meal_type, name, quantity_g,
            kcal, protein_g, carbs_g, fat_g, fiber_g,
            source, food_cache_id, photo_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          meal.profile_id, meal.date, meal.meal_type, meal.name, meal.quantity_g,
          meal.kcal, meal.protein_g, meal.carbs_g, meal.fat_g, meal.fiber_g ?? null,
          meal.source, meal.food_cache_id ?? null, meal.photo_path ?? null, now,
        ]
      );

      const newMeal: MealLog = { ...meal, id: result.lastInsertRowId, created_at: now };
      set(state => ({ meals: [...state.meals, newMeal] }));
      await get().refreshSummary(meal.profile_id);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteMeal: async (id) => {
    const meal = get().meals.find(m => m.id === id);
    if (!meal) return;
    try {
      const db = await getDb();
      await db.runAsync('DELETE FROM meal_log WHERE id = ?', [id]);
      set(state => ({ meals: state.meals.filter(m => m.id !== id) }));
      await get().refreshSummary(meal.profile_id);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  refreshSummary: async (profileId) => {
    const { date, summary } = get();
    try {
      const db = await getDb();
      const now = new Date().toISOString();

      const totals = await db.getFirstAsync<TotalsRow>(
        `SELECT
           COALESCE(SUM(kcal),      0) AS total_kcal,
           COALESCE(SUM(protein_g), 0) AS total_protein_g,
           COALESCE(SUM(carbs_g),   0) AS total_carbs_g,
           COALESCE(SUM(fat_g),     0) AS total_fat_g
         FROM meal_log WHERE profile_id = ? AND date = ?`,
        [profileId, date]
      );
      if (!totals) return;

      const profileRow = await db.getFirstAsync<{ daily_kcal_target: number | null }>(
        'SELECT daily_kcal_target FROM profile WHERE id = ?',
        [profileId]
      );
      const kcalTarget = profileRow?.daily_kcal_target ?? null;

      if (summary) {
        await db.runAsync(
          `UPDATE daily_summary
             SET total_kcal = ?, total_protein_g = ?, total_carbs_g = ?,
                 total_fat_g = ?, kcal_target = ?, updated_at = ?
           WHERE id = ?`,
          [totals.total_kcal, totals.total_protein_g, totals.total_carbs_g,
           totals.total_fat_g, kcalTarget, now, summary.id]
        );
        set(state => ({
          summary: state.summary
            ? { ...state.summary, ...totals, kcal_target: kcalTarget, updated_at: now }
            : null,
        }));
      } else {
        const result = await db.runAsync(
          `INSERT INTO daily_summary
             (profile_id, date, total_kcal, total_protein_g, total_carbs_g,
              total_fat_g, kcal_target, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [profileId, date, totals.total_kcal, totals.total_protein_g,
           totals.total_carbs_g, totals.total_fat_g, kcalTarget, now, now]
        );
        const newSummary = await db.getFirstAsync<DailySummary>(
          'SELECT * FROM daily_summary WHERE id = ?',
          [result.lastInsertRowId]
        );
        set({ summary: newSummary ?? null });
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setTrainingDone: async (profileId, sessionId, volumeKg) => {
    const { date, summary } = get();
    try {
      const db = await getDb();
      const now = new Date().toISOString();

      if (summary) {
        await db.runAsync(
          `UPDATE daily_summary
             SET trained = 1, training_session_id = ?, training_volume_kg = ?, updated_at = ?
           WHERE id = ?`,
          [sessionId, volumeKg, now, summary.id]
        );
        set(state => ({
          summary: state.summary
            ? { ...state.summary, trained: 1, training_session_id: sessionId, training_volume_kg: volumeKg, updated_at: now }
            : null,
        }));
      } else {
        // Create summary row if it doesn't exist yet
        const result = await db.runAsync(
          `INSERT INTO daily_summary
             (profile_id, date, trained, training_session_id, training_volume_kg, created_at, updated_at)
           VALUES (?, ?, 1, ?, ?, ?, ?)`,
          [profileId, date, sessionId, volumeKg, now, now]
        );
        const newSummary = await db.getFirstAsync<DailySummary>(
          'SELECT * FROM daily_summary WHERE id = ?',
          [result.lastInsertRowId]
        );
        set({ summary: newSummary ?? null });
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setLlmTip: async (tip) => {
    const { summary } = get();
    if (!summary) return;
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      await db.runAsync(
        'UPDATE daily_summary SET llm_tip = ?, tip_generated_at = ? WHERE id = ?',
        [tip, now, summary.id]
      );
      set(state => ({
        summary: state.summary
          ? { ...state.summary, llm_tip: tip, tip_generated_at: now }
          : null,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));

import { create } from 'zustand';
import { getDb } from '../lib/db/init';

export interface Profile {
  id: number;
  name: string;
  gender: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string | null;
  goal_target_weight_kg: number | null;
  goal_deadline: string | null;
  training_days_per_week: number | null;
  experience_level: string;
  equipment: string;
  preferred_time: string | null;
  diet_type: string;
  meals_per_day: number | null;
  cooking_willingness: number | null;
  job_type: string | null;
  activity_level: string | null;
  avg_sleep_hours: number | null;
  injuries: string | null;
  daily_kcal_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  created_at: string;
  updated_at: string;
}

export type ProfileInput = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;

type BindValue = string | number | null;

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  upsert: (data: ProfileInput) => Promise<void>;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  loading: true,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<Profile>('SELECT * FROM profile WHERE id = 1');
      set({ profile: row ?? null, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  upsert: async (data) => {
    set({ loading: true, error: null });
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM profile WHERE id = 1'
      );

      if (!existing) {
        const clean = Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== undefined)
        ) as Record<string, BindValue>;
        const allData: Record<string, BindValue> = { id: 1, ...clean, created_at: now, updated_at: now };
        const keys = Object.keys(allData);
        const values = Object.values(allData);
        await db.runAsync(
          `INSERT INTO profile (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          values
        );
      } else {
        const clean = Object.entries(data).filter(([, v]) => v !== undefined) as [string, BindValue][];
        if (clean.length > 0) {
          await db.runAsync(
            `UPDATE profile SET ${clean.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = 1`,
            [...clean.map(([, v]) => v), now]
          );
        }
      }

      const row = await db.getFirstAsync<Profile>('SELECT * FROM profile WHERE id = 1');
      set({ profile: row ?? null, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  reset: () => set({ profile: null, error: null, loading: false }),
}));

export const isOnboarded = (profile: Profile | null): boolean =>
  profile !== null && profile.goal !== null && profile.daily_kcal_target !== null;

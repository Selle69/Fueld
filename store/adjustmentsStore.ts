import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AdjustableField = "default_sets" | "default_reps" | "default_weight_kg" | "default_rest_sec";

export interface Adjustment {
  exercise_id: number;
  exercise_name: string;
  field: AdjustableField;
  current_value: number;
  suggested_value: number;
  reason: string;
}

interface AdjustmentsState {
  date: string | null;
  workout_day_id: number | null;
  adjustments: Adjustment[];
  set: (date: string, dayId: number, adjustments: Adjustment[]) => void;
  clear: () => void;
}

export const useAdjustmentsStore = create<AdjustmentsState>()(
  persist(
    (set) => ({
      date: null,
      workout_day_id: null,
      adjustments: [],
      set: (date, dayId, adjustments) => set({ date, dayId: undefined, workout_day_id: dayId, adjustments }),
      clear: () => set({ date: null, workout_day_id: null, adjustments: [] }),
    }),
    { name: "coach_adjustments" },
  ),
);

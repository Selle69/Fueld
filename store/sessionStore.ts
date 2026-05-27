import { create } from 'zustand';
import { getDb } from '../lib/db/init';

export interface LoggedSet {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  set_number: number;
  set_type: string;
  reps_target: number | null;
  reps_done: number | null;
  weight_kg: number;
  to_failure: 0 | 1;
  rpe: number | null;
  rest_sec_actual: number | null;
  completed: 0 | 1;
}

export interface SessionExercise {
  exercise_id: number;
  exercise_name: string;
  muscle_group: string | null;
  sort_order: number;
  superset_group: number | null;
  default_sets: number;
  default_reps: number;
  default_weight_kg: number;
  default_rest_sec: number;
  sets: LoggedSet[];
}

interface DbExerciseRow {
  id: number;
  workout_day_id: number;
  name: string;
  muscle_group: string | null;
  sort_order: number;
  superset_group: number | null;
  default_sets: number;
  default_reps: number;
  default_weight_kg: number;
  default_rest_sec: number;
  notes: string | null;
}

interface DbTemplateExerciseRow {
  id: number;
  template_id: number;
  name: string;
  muscle_group: string | null;
  sort_order: number;
  default_sets: number;
  default_reps: number;
  default_weight_kg: number;
  default_rest_sec: number;
  notes: string | null;
}

export type SetInput = {
  set_number: number;
  set_type?: string;
  reps_target?: number;
  reps_done?: number;
  weight_kg: number;
  to_failure?: 0 | 1;
  rpe?: number;
};

type BindValue = string | number | null;

interface SessionState {
  sessionId: number | null;
  workoutDayId: number | null;
  templateId: number | null;
  startedAt: string | null;
  exercises: SessionExercise[];
  loading: boolean;
  error: string | null;

  startSession: (profileId: number, workoutDayId?: number, templateId?: number) => Promise<void>;
  logSet: (exerciseId: number, exerciseName: string, data: SetInput) => Promise<void>;
  updateSet: (setId: number, data: Partial<Pick<LoggedSet, 'reps_done' | 'weight_kg' | 'rpe' | 'to_failure' | 'completed' | 'rest_sec_actual'>>) => Promise<void>;
  markSetComplete: (setId: number) => Promise<void>;
  finishSession: (feedback?: number, notes?: string) => Promise<void>;
  cancelSession: () => Promise<void>;
  reset: () => void;
}

function isoDate(): string {
  return new Date().toISOString().split('T')[0];
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  workoutDayId: null,
  templateId: null,
  startedAt: null,
  exercises: [],
  loading: false,
  error: null,

  startSession: async (profileId, workoutDayId, templateId) => {
    set({ loading: true, error: null });
    try {
      const db = await getDb();
      const now = new Date().toISOString();

      const result = await db.runAsync(
        `INSERT INTO training_session (profile_id, workout_day_id, template_id, date, started_at) VALUES (?, ?, ?, ?, ?)`,
        [profileId, workoutDayId ?? null, templateId ?? null, isoDate(), now]
      );
      const sessionId = result.lastInsertRowId;

      let exercises: SessionExercise[] = [];
      if (workoutDayId != null) {
        const rows = await db.getAllAsync<DbExerciseRow>(
          'SELECT * FROM exercise WHERE workout_day_id = ? ORDER BY sort_order',
          [workoutDayId]
        );
        exercises = rows.map(ex => ({
          exercise_id: ex.id,
          exercise_name: ex.name,
          muscle_group: ex.muscle_group,
          sort_order: ex.sort_order,
          superset_group: ex.superset_group,
          default_sets: ex.default_sets,
          default_reps: ex.default_reps,
          default_weight_kg: ex.default_weight_kg,
          default_rest_sec: ex.default_rest_sec,
          sets: [],
        }));
      } else if (templateId != null) {
        const rows = await db.getAllAsync<DbTemplateExerciseRow>(
          'SELECT * FROM template_exercise WHERE template_id = ? ORDER BY sort_order',
          [templateId]
        );
        exercises = rows.map(ex => ({
          exercise_id: ex.id,
          exercise_name: ex.name,
          muscle_group: ex.muscle_group,
          sort_order: ex.sort_order,
          superset_group: null,
          default_sets: ex.default_sets,
          default_reps: ex.default_reps,
          default_weight_kg: ex.default_weight_kg,
          default_rest_sec: ex.default_rest_sec,
          sets: [],
        }));
      }

      set({ sessionId, workoutDayId: workoutDayId ?? null, templateId: templateId ?? null, startedAt: now, exercises, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  logSet: async (exerciseId, exerciseName, data) => {
    const { sessionId } = get();
    if (sessionId == null) return;

    try {
      const db = await getDb();
      const result = await db.runAsync(
        `INSERT INTO session_set
           (session_id, exercise_id, exercise_name, set_number, set_type,
            reps_target, reps_done, weight_kg, to_failure, rpe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId, exerciseId, exerciseName, data.set_number,
          data.set_type ?? 'working', data.reps_target ?? null,
          data.reps_done ?? null, data.weight_kg,
          data.to_failure ?? 0, data.rpe ?? null,
        ]
      );

      const newSet: LoggedSet = {
        id: result.lastInsertRowId,
        session_id: sessionId,
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        set_number: data.set_number,
        set_type: data.set_type ?? 'working',
        reps_target: data.reps_target ?? null,
        reps_done: data.reps_done ?? null,
        weight_kg: data.weight_kg,
        to_failure: data.to_failure ?? 0,
        rpe: data.rpe ?? null,
        rest_sec_actual: null,
        completed: 0,
      };

      const exercises = get().exercises;
      const idx = exercises.findIndex(ex => ex.exercise_id === exerciseId);

      if (idx >= 0) {
        set({
          exercises: exercises.map((ex, i) =>
            i === idx ? { ...ex, sets: [...ex.sets, newSet] } : ex
          ),
        });
      } else {
        set({
          exercises: [
            ...exercises,
            {
              exercise_id: exerciseId,
              exercise_name: exerciseName,
              muscle_group: null,
              sort_order: exercises.length,
              superset_group: null,
              default_sets: 3,
              default_reps: 10,
              default_weight_kg: data.weight_kg,
              default_rest_sec: 90,
              sets: [newSet],
            },
          ],
        });
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateSet: async (setId, data) => {
    try {
      const db = await getDb();
      const entries = Object.entries(data).filter(([, v]) => v !== undefined) as [string, BindValue][];
      if (entries.length === 0) return;

      await db.runAsync(
        `UPDATE session_set SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`,
        [...entries.map(([, v]) => v), setId]
      );

      set({
        exercises: get().exercises.map(ex => ({
          ...ex,
          sets: ex.sets.map(s => (s.id === setId ? { ...s, ...data } : s)),
        })),
      });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  markSetComplete: async (setId) => {
    try {
      const db = await getDb();
      await db.runAsync('UPDATE session_set SET completed = 1 WHERE id = ?', [setId]);
      set({
        exercises: get().exercises.map(ex => ({
          ...ex,
          sets: ex.sets.map(s => (s.id === setId ? { ...s, completed: 1 as const } : s)),
        })),
      });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  finishSession: async (feedback, notes) => {
    const { sessionId, startedAt, exercises } = get();
    if (sessionId == null) return;

    set({ loading: true });
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const durationMin = startedAt
        ? Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
        : null;

      const doneSets = exercises.flatMap(ex => ex.sets).filter(s => s.completed === 1);
      const totalVolume = doneSets.reduce(
        (sum, s) => sum + s.weight_kg * (s.reps_done ?? 0),
        0
      );

      await db.runAsync(
        `UPDATE training_session
           SET finished_at = ?, duration_min = ?, feedback = ?, total_volume_kg = ?, notes = ?
         WHERE id = ?`,
        [now, durationMin, feedback ?? null, totalVolume, notes ?? null, sessionId]
      );

      // Write exercise history
      const sessionRow = await db.getFirstAsync<{ profile_id: number }>(
        'SELECT profile_id FROM training_session WHERE id = ?',
        [sessionId]
      );
      if (sessionRow) {
        const today = isoDate();
        for (const ex of exercises) {
          const exDone = ex.sets.filter(s => s.completed === 1);
          if (exDone.length === 0) continue;

          const avgReps = exDone.reduce((s, r) => s + (r.reps_done ?? 0), 0) / exDone.length;
          const avgWeight = exDone.reduce((s, r) => s + r.weight_kg, 0) / exDone.length;
          const maxWeight = Math.max(...exDone.map(s => s.weight_kg));
          const volume = exDone.reduce((s, r) => s + r.weight_kg * (r.reps_done ?? 0), 0);
          const avgRpe = exDone.some(s => s.rpe != null)
            ? Math.round(exDone.reduce((s, r) => s + (r.rpe ?? 0), 0) / exDone.length)
            : null;

          const prev = await db.getFirstAsync<{ max_weight_kg: number }>(
            `SELECT max_weight_kg FROM exercise_history
             WHERE profile_id = ? AND exercise_name = ?
             ORDER BY session_date DESC LIMIT 1`,
            [sessionRow.profile_id, ex.exercise_name]
          );
          const isPr = prev == null || maxWeight > prev.max_weight_kg ? 1 : 0;

          await db.runAsync(
            `INSERT INTO exercise_history
               (profile_id, exercise_name, session_id, session_date,
                sets_done, avg_reps, avg_weight_kg, max_weight_kg,
                total_volume, rpe, feedback, is_pr)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sessionRow.profile_id, ex.exercise_name, sessionId, today,
              exDone.length, avgReps, avgWeight, maxWeight,
              volume, avgRpe, feedback ?? null, isPr,
            ]
          );
        }
      }

      set({ sessionId: null, workoutDayId: null, startedAt: null, exercises: [], loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  cancelSession: async () => {
    const { sessionId } = get();
    if (sessionId != null) {
      try {
        const db = await getDb();
        await db.runAsync('DELETE FROM training_session WHERE id = ?', [sessionId]);
      } catch (_e) {
        // best-effort delete; session stays orphaned if it fails
      }
    }
    set({ sessionId: null, workoutDayId: null, templateId: null, startedAt: null, exercises: [], error: null });
  },

  reset: () =>
    set({ sessionId: null, workoutDayId: null, templateId: null, startedAt: null, exercises: [], loading: false, error: null }),
}));

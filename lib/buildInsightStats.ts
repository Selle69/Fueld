import { getDb } from "@/lib/db/init";

interface Profile {
  goal?: string | null;
  daily_kcal_target?: number | null;
  protein_target_g?: number | null;
  carbs_target_g?: number | null;
  fat_target_g?: number | null;
  training_days_per_week?: number | null;
  avg_sleep_hours?: number | null;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
}

function trend(arr: number[]): "steigend" | "fallend" | "stabil" {
  if (arr.length < 3) return "stabil";
  const first = arr.slice(0, Math.ceil(arr.length / 2));
  const last = arr.slice(Math.floor(arr.length / 2));
  const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
  const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;
  const diff = lastAvg - firstAvg;
  if (diff > firstAvg * 0.08) return "steigend";
  if (diff < -firstAvg * 0.08) return "fallend";
  return "stabil";
}

export async function buildInsightStats(profile: Profile | null) {
  const db = await getDb();

  const d14 = daysAgo(14);
  const d7 = daysAgo(7);
  const d28 = daysAgo(28);

  // ── Sleep ────────────────────────────────────────────────────────────────
  const sleepRows = await db.getAllAsync<{ quality: number; duration_h: number | null; date: string }>(
    `SELECT quality, duration_h, date FROM sleep_log WHERE profile_id = 1 AND date >= ? ORDER BY date ASC`,
    [d14],
  );
  const sleepQuals = sleepRows.map(r => r.quality);
  const sleepHours = sleepRows.filter(r => r.duration_h != null).map(r => r.duration_h!);
  const poorNights = sleepQuals.filter(q => q <= 4).length;

  const sleep = {
    eintraege_14d: sleepRows.length,
    durchschnitt_qualitaet: avg(sleepQuals),
    durchschnitt_stunden: avg(sleepHours),
    schlechte_naechte: poorNights,
    trend_qualitaet: trend(sleepQuals),
  };

  // ── Nutrition ────────────────────────────────────────────────────────────
  const nutRows = await db.getAllAsync<{ date: string; kcal: number; protein_g: number }>(
    `SELECT date, COALESCE(SUM(kcal),0) AS kcal, COALESCE(SUM(protein_g),0) AS protein_g
     FROM meal_log WHERE profile_id = 1 AND date >= ? GROUP BY date ORDER BY date ASC`,
    [d14],
  );
  const kcalArr = nutRows.map(r => r.kcal).filter(k => k > 0);
  const protArr = nutRows.map(r => r.protein_g).filter(p => p > 0);
  const kcalTarget = profile?.daily_kcal_target ?? null;
  const protTarget = profile?.protein_target_g ?? null;
  const daysUnderKcal = kcalTarget
    ? nutRows.filter(r => r.kcal > 0 && r.kcal < kcalTarget * 0.8).length
    : null;
  const daysUnderProtein = protTarget
    ? nutRows.filter(r => r.protein_g > 0 && r.protein_g < protTarget * 0.75).length
    : null;

  const nutrition = {
    erfasste_tage_14d: nutRows.length,
    durchschnitt_kcal: avg(kcalArr),
    durchschnitt_protein_g: avg(protArr),
    ziel_kcal: kcalTarget,
    ziel_protein_g: protTarget,
    tage_unter_kalorien: daysUnderKcal,
    tage_unter_protein: daysUnderProtein,
    trend_kcal: trend(kcalArr),
  };

  // ── Training ─────────────────────────────────────────────────────────────
  const trainRecent = await db.getAllAsync<{ date: string; total_volume_kg: number | null; duration_min: number | null }>(
    `SELECT date, total_volume_kg, duration_min FROM training_session
     WHERE profile_id = 1 AND date >= ? AND finished_at IS NOT NULL ORDER BY date ASC`,
    [d7],
  );
  const trainPrev = await db.getAllAsync<{ total_volume_kg: number | null }>(
    `SELECT total_volume_kg FROM training_session
     WHERE profile_id = 1 AND date >= ? AND date < ? AND finished_at IS NOT NULL`,
    [d28, d7],
  );

  const recentVols = trainRecent.map(r => r.total_volume_kg ?? 0).filter(v => v > 0);
  const prevVols = trainPrev.map(r => r.total_volume_kg ?? 0).filter(v => v > 0);
  const avgRecentVol = avg(recentVols);
  const avgPrevVol = avg(prevVols);
  const volChangePct = avgRecentVol && avgPrevVol
    ? +(((avgRecentVol - avgPrevVol) / avgPrevVol) * 100).toFixed(0)
    : null;

  const training = {
    sessions_7d: trainRecent.length,
    sessions_prev_14d: trainPrev.length,
    durchschnitt_volumen_kg_7d: avgRecentVol,
    volumen_aenderung_prozent: volChangePct,
    ziel_tage_pro_woche: profile?.training_days_per_week ?? null,
  };

  // ── Exercise stagnation ──────────────────────────────────────────────────
  const exStag = await db.getAllAsync<{
    exercise_name: string;
    max_recent: number | null;
    max_prev: number | null;
    sessions_recent: number;
  }>(
    `SELECT
       exercise_name,
       MAX(CASE WHEN session_date >= ? THEN max_weight_kg END) AS max_recent,
       MAX(CASE WHEN session_date < ? AND session_date >= ? THEN max_weight_kg END) AS max_prev,
       COUNT(CASE WHEN session_date >= ? THEN 1 END) AS sessions_recent
     FROM exercise_history
     WHERE profile_id = 1 AND session_date >= ?
     GROUP BY exercise_name
     HAVING sessions_recent >= 2
     ORDER BY sessions_recent DESC
     LIMIT 6`,
    [d14, d14, d28, d14, d28],
  );

  const stagnierende = exStag
    .filter(e => e.max_recent != null && e.max_prev != null && e.max_recent <= e.max_prev)
    .map(e => e.exercise_name);

  const exercises = {
    stagnierende_uebungen: stagnierende,
    haeufigste_uebungen: exStag.map(e => e.exercise_name),
  };

  // ── Body weight ──────────────────────────────────────────────────────────
  const d60 = daysAgo(60);
  const d30 = daysAgo(30);

  const bwRecent = await db.getFirstAsync<{ weight_kg: number; date: string }>(
    `SELECT weight_kg, date FROM body_log WHERE profile_id = 1 ORDER BY date DESC LIMIT 1`,
  );
  const bw30ago = await db.getFirstAsync<{ weight_kg: number }>(
    `SELECT weight_kg FROM body_log WHERE profile_id = 1 AND date <= ? ORDER BY date DESC LIMIT 1`,
    [d30],
  );
  const bw60ago = await db.getFirstAsync<{ weight_kg: number }>(
    `SELECT weight_kg FROM body_log WHERE profile_id = 1 AND date <= ? ORDER BY date DESC LIMIT 1`,
    [d60],
  );
  // Count distinct weigh-in days in the last 60 days to gauge data quality
  const bwEntries = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM body_log WHERE profile_id = 1 AND date >= ?`,
    [d60],
  );

  const change30 = bwRecent && bw30ago
    ? +(bwRecent.weight_kg - bw30ago.weight_kg).toFixed(1)
    : null;
  const change60 = bwRecent && bw60ago
    ? +(bwRecent.weight_kg - bw60ago.weight_kg).toFixed(1)
    : null;

  // Stagnation: movement < 0.5 kg over 30 days despite a clear goal
  const goal = profile?.goal ?? null;
  const isWeightGoal = goal === "lose_weight" || goal === "gain_weight";
  const stagniert = isWeightGoal && change30 != null && Math.abs(change30) < 0.5;

  const koerpergewicht = bwRecent ? {
    aktuell_kg: bwRecent.weight_kg,
    veraenderung_30d_kg: change30,
    veraenderung_60d_kg: change60,
    eintraege_60d: bwEntries?.n ?? 0,
    stagnation_erkannt: stagniert,
    ziel_richtung: goal === "lose_weight" ? "abnehmen" : goal === "gain_weight" ? "zunehmen" : "halten",
  } : null;

  // ── Today's planned workout ──────────────────────────────────────────────
  const dow = ((new Date().getDay() + 6) % 7) + 1; // 1=Mo … 7=So
  const dowStr = String(dow);

  const todayDayRow = await db.getFirstAsync<{ id: number; name: string; focus: string | null }>(
    `SELECT wd.id, wd.name, wd.focus
     FROM workout_day wd
     JOIN workout_plan wp ON wd.plan_id = wp.id
     WHERE wp.is_active = 1 AND wp.profile_id = 1
       AND (wd.day_mask = ? OR wd.day_mask LIKE ? OR wd.day_mask LIKE ? OR wd.day_mask LIKE ?)
     LIMIT 1`,
    [dowStr, dowStr + ",%", "%," + dowStr, "%," + dowStr + ",%"],
  );

  let heutiges_training: object | null = null;
  if (todayDayRow) {
    const exRows = await db.getAllAsync<{
      id: number; name: string; muscle_group: string | null;
      default_sets: number; default_reps: number;
      default_weight_kg: number; default_rest_sec: number;
    }>(
      `SELECT id, name, muscle_group, default_sets, default_reps, default_weight_kg, default_rest_sec
       FROM exercise WHERE workout_day_id = ? ORDER BY sort_order, id`,
      [todayDayRow.id],
    );
    heutiges_training = {
      workout_day_id: todayDayRow.id,
      name: todayDayRow.name,
      fokus: todayDayRow.focus,
      uebungen: exRows.map(e => ({
        id: e.id,
        name: e.name,
        muskel: e.muscle_group,
        saetze: e.default_sets,
        wiederholungen: e.default_reps,
        gewicht_kg: e.default_weight_kg,
        pause_sek: e.default_rest_sec,
      })),
    };
  }

  // ── Profile summary ──────────────────────────────────────────────────────
  const profil = {
    ziel: profile?.goal ?? null,
    kcal_ziel: profile?.daily_kcal_target ?? null,
    protein_ziel_g: profile?.protein_target_g ?? null,
    durchschnitt_schlaf_ziel_h: profile?.avg_sleep_hours ?? null,
  };

  return { profil, schlaf: sleep, ernaehrung: nutrition, training, uebungen: exercises, koerpergewicht, heutiges_training };
}

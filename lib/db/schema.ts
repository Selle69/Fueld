export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profile (
  id                      INTEGER PRIMARY KEY,
  name                    TEXT    NOT NULL DEFAULT 'Nutzer',
  gender                  TEXT,
  age                     INTEGER,
  height_cm               REAL,
  weight_kg               REAL,
  goal                    TEXT,
  goal_target_weight_kg   REAL,
  goal_deadline           TEXT,
  training_days_per_week  INTEGER,
  experience_level        TEXT    DEFAULT 'beginner',
  equipment               TEXT    DEFAULT 'gym',
  preferred_time          TEXT,
  diet_type               TEXT    DEFAULT 'none',
  meals_per_day           INTEGER,
  cooking_willingness     INTEGER,
  job_type                TEXT,
  activity_level          TEXT,
  avg_sleep_hours         REAL,
  injuries                TEXT,
  daily_kcal_target       INTEGER,
  protein_target_g        REAL,
  carbs_target_g          REAL,
  fat_target_g            REAL,
  created_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS workout_plan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS workout_day (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id     INTEGER NOT NULL REFERENCES workout_plan(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  focus       TEXT
);

CREATE TABLE IF NOT EXISTS exercise (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_day_id    INTEGER NOT NULL REFERENCES workout_day(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  muscle_group      TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  superset_group    INTEGER,
  default_sets      INTEGER NOT NULL DEFAULT 3,
  default_reps      INTEGER NOT NULL DEFAULT 10,
  default_weight_kg REAL    NOT NULL DEFAULT 0,
  default_rest_sec  INTEGER NOT NULL DEFAULT 90,
  notes             TEXT
);

CREATE TABLE IF NOT EXISTS training_session (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id      INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  workout_day_id  INTEGER,
  date            TEXT    NOT NULL,
  started_at      TEXT,
  finished_at     TEXT,
  duration_min    INTEGER,
  feedback        INTEGER,
  total_volume_kg REAL,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS session_set (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      INTEGER NOT NULL REFERENCES training_session(id) ON DELETE CASCADE,
  exercise_id     INTEGER NOT NULL,
  exercise_name   TEXT    NOT NULL,
  set_number      INTEGER NOT NULL,
  set_type        TEXT    NOT NULL DEFAULT 'working',
  reps_target     INTEGER,
  reps_done       INTEGER,
  weight_kg       REAL    NOT NULL DEFAULT 0,
  to_failure      INTEGER NOT NULL DEFAULT 0,
  rpe             INTEGER,
  tempo           TEXT,
  rest_sec_actual INTEGER,
  completed       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercise_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id    INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  exercise_name TEXT    NOT NULL,
  session_id    INTEGER NOT NULL,
  session_date  TEXT    NOT NULL,
  sets_done     INTEGER,
  avg_reps      REAL,
  avg_weight_kg REAL,
  max_weight_kg REAL,
  total_volume  REAL,
  rpe           INTEGER,
  feedback      INTEGER,
  is_pr         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meal_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id    INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  date          TEXT    NOT NULL,
  meal_type     TEXT    NOT NULL DEFAULT 'snack',
  name          TEXT    NOT NULL,
  quantity_g    REAL    NOT NULL,
  kcal          REAL    NOT NULL DEFAULT 0,
  protein_g     REAL    NOT NULL DEFAULT 0,
  carbs_g       REAL    NOT NULL DEFAULT 0,
  fat_g         REAL    NOT NULL DEFAULT 0,
  fiber_g       REAL,
  source        TEXT    NOT NULL DEFAULT 'manual',
  food_cache_id INTEGER,
  photo_path    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS food_cache (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  name_normalized  TEXT    NOT NULL UNIQUE,
  kcal_per_100g    REAL    NOT NULL,
  protein_per_100g REAL    NOT NULL DEFAULT 0,
  carbs_per_100g   REAL    NOT NULL DEFAULT 0,
  fat_per_100g     REAL    NOT NULL DEFAULT 0,
  fiber_per_100g   REAL,
  source           TEXT    NOT NULL DEFAULT 'llm',
  use_count        INTEGER NOT NULL DEFAULT 1,
  last_used_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  cached_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS daily_summary (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id          INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  date                TEXT    NOT NULL UNIQUE,
  total_kcal          REAL    NOT NULL DEFAULT 0,
  total_protein_g     REAL    NOT NULL DEFAULT 0,
  total_carbs_g       REAL    NOT NULL DEFAULT 0,
  total_fat_g         REAL    NOT NULL DEFAULT 0,
  kcal_target         INTEGER,
  trained             INTEGER NOT NULL DEFAULT 0,
  training_session_id INTEGER,
  training_volume_kg  REAL,
  llm_tip             TEXT,
  tip_generated_at    TEXT,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS body_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL UNIQUE,
  weight_kg  REAL    NOT NULL,
  notes      TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_session_date
  ON training_session(profile_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_history_lookup
  ON exercise_history(profile_id, exercise_name, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_log_date
  ON meal_log(profile_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_food_cache_normalized
  ON food_cache(name_normalized);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date
  ON daily_summary(profile_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_body_log_date
  ON body_log(profile_id, date DESC);

CREATE TABLE IF NOT EXISTS workout_template (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  focus       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS template_exercise (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id       INTEGER NOT NULL REFERENCES workout_template(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  muscle_group      TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  default_sets      INTEGER NOT NULL DEFAULT 3,
  default_reps      INTEGER NOT NULL DEFAULT 10,
  default_weight_kg REAL    NOT NULL DEFAULT 0,
  default_rest_sec  INTEGER NOT NULL DEFAULT 90,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_template_exercise_template
  ON template_exercise(template_id, sort_order);
`;

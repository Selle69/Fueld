import type { Database, SqlJsStatic } from "sql.js";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { SCHEMA_SQL } from "./schema";

type InitSqlJs = (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;

const DB_KEY = "fueld_db";

type BindValue = string | number | null;

class SqlJsWrapper {
  constructor(private db: Database) {}

  async getFirstAsync<T>(sql: string, params: BindValue[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const result = stmt.step() ? (stmt.getAsObject() as T) : null;
    stmt.free();
    return result;
  }

  async getAllAsync<T>(sql: string, params: BindValue[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }

  async runAsync(sql: string, params: BindValue[] = []): Promise<{ lastInsertRowId: number }> {
    const stmt = this.db.prepare(sql);
    stmt.run(params);
    stmt.free();
    const row = this.db.exec("SELECT last_insert_rowid()");
    const lastInsertRowId = (row[0]?.values[0]?.[0] as number) ?? 0;
    await this._persist();
    return { lastInsertRowId };
  }

  async execAsync(sql: string): Promise<void> {
    this.db.run(sql);
    await this._persist();
  }

  private async _persist(): Promise<void> {
    await idbSet(DB_KEY, this.db.export());
  }
}

async function migrate(db: SqlJsWrapper): Promise<void> {
  const wdCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(workout_day)");
  if (!wdCols.some(c => c.name === "day_mask")) {
    await db.execAsync("ALTER TABLE workout_day ADD COLUMN day_mask TEXT");
    await db.execAsync("UPDATE workout_day SET day_mask = CAST(day_of_week AS TEXT) WHERE day_mask IS NULL");
  }

  const tsCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(training_session)");
  if (!tsCols.some(c => c.name === "template_id")) {
    await db.execAsync("ALTER TABLE training_session ADD COLUMN template_id INTEGER");
  }
}

let _db: SqlJsWrapper | null = null;

const timeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error(`Timeout (${ms}ms): ${label}`)), ms))]);

export async function getDb(): Promise<SqlJsWrapper> {
  if (_db) return _db;

  if (!window.WebAssembly) throw new Error("WebAssembly wird von diesem Browser nicht unterstützt");

  const wasmUrl = `${window.location.origin}/sql-wasm.wasm`;

  const mod = await timeout(
    import("sql.js/dist/sql-wasm-browser.js"),
    10000,
    "sql.js browser chunk laden",
  );
  const initSqlJs = mod.default;

  const SQL = await timeout(
    initSqlJs({ locateFile: () => wasmUrl }),
    10000,
    `WASM laden von ${wasmUrl}`
  );

  const saved = await idbGet<Uint8Array>(DB_KEY);
  const db = saved ? new SQL.Database(saved) : new SQL.Database();

  _db = new SqlJsWrapper(db);
  await _db.execAsync(SCHEMA_SQL);
  await migrate(_db);
  return _db;
}

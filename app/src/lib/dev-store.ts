/**
 * DEV-ONLY fallback store. Enabled only when DEV_NO_DB=true and NODE_ENV!=production and Supabase is not configured.
 * NOT for production. No RLS, no SQL constraints, in-memory (globalThis) — data resets on server restart.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, unknown>;
type TableName = string;

type DbState = { tables: Record<TableName, Row[]>; seq: number };

const DB_FILE = path.resolve(process.cwd(), ".dev-db.json");

function loadState(): DbState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(content) as DbState;
    }
  } catch {
    // fallback to empty
  }
  return { tables: {}, seq: 1 };
}

function saveState(s: DbState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(s, null, 2), "utf-8");
  } catch {
    // ignore in environments without write access
  }
}

function state(): DbState {
  const g = globalThis as typeof globalThis & { __saDevDb?: DbState };
  if (!g.__saDevDb) {
    g.__saDevDb = loadState();
  }
  return g.__saDevDb;
}
function table(name: string) { const s = state(); (s.tables[name] ??= []); return s.tables[name]; }
function normHex(v: unknown) { return String(v ?? "").replace(/^\\x/, "").toLowerCase(); }

class Query {
  private name: string;
  private op: "select" | "insert" | "update" = "select";
  private rows: Row[] | null = null;
  private filters: Array<(r: Row) => boolean> = [];
  private _order: { col: string; asc: boolean } | null = null;
  private _limit: number | null = null;
  private _countHead = false;
  private _selectCols = "*";
  constructor(name: string) { this.name = name; }
  select(cols = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (this.op === "insert" || this.op === "update") { this._selectCols = cols; return this; }
    this.op = "select"; this._selectCols = cols; this._countHead = Boolean(opts?.head); return this;
  }
  insert(payload: Row | Row[]) { this.op = "insert"; this.rows = Array.isArray(payload) ? payload : [payload]; return this; }
  update(patch: Row) { this.op = "update"; this.rows = [patch]; return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => (col === "token_hash" ? normHex(r[col]) === normHex(val) : r[col] === val)); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this._order = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this._limit = n; return this; }
  maybeSingle() { return this._exec(true); }
  single() { return this._exec(false, true); }
  then<TResult1 = unknown, TResult2 = never>(onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
    return this._exec(false).then(onfulfilled, onrejected);
  }
  private async _exec(maybe: boolean, must = false): Promise<{ data: unknown; error: null | { message: string; code?: string }; count?: number | null }> {
    try {
      const t = table(this.name);
      const match = (r: Row) => this.filters.every((f) => f(r));
      if (this.op === "insert") {
        const now = new Date().toISOString();
        const inserted = (this.rows || []).map((r) => {
          // basic unique checks for known keys
          for (const k of ["id", "email", "username", "badge_code", "token_hash", "client_uuid"]) {
            if (r[k] != null && t.some((x) => x[k] === r[k])) return { __err: { message: `duplicate ${k}`, code: "23505" } };
          }
          const row = { id: r.id ?? crypto.randomUUID(), created_at: r.created_at ?? now, ...r };
          t.push(row); return row;
        });
        const err = inserted.find((r) => (r as Row).__err) as { __err: { message: string; code: string } } | undefined;
        if (err) return { data: null, error: err.__err };
        saveState(state());
        if (this._selectCols && this._selectCols !== "*") return { data: must ? inserted[0] : inserted, error: null };
        return { data: must ? inserted[0] : (maybe ? inserted[0] ?? null : inserted), error: null };
      }
      if (this.op === "update") {
        let n = 0; const patch = (this.rows || [])[0] || {};
        for (const r of t) if (match(r)) { Object.assign(r, patch); n++; }
        saveState(state());
        return { data: n, error: null };
      }
      let res = t.filter(match);
      if (this._order) res = [...res].sort((a, b) => { const av = String(a[this._order!.col] ?? ""); const bv = String(b[this._order!.col] ?? ""); return this._order!.asc ? av.localeCompare(bv) : bv.localeCompare(av); });
      if (this._limit != null) res = res.slice(0, this._limit);
      if (this._countHead) return { data: null, error: null, count: res.length };
      if (maybe) return { data: res[0] ?? null, error: null };
      if (must) return res[0] ? { data: res[0], error: null } : { data: null, error: { message: "not found" } };
      return { data: res, error: null };
    } catch (e) { return { data: null, error: { message: e instanceof Error ? e.message : String(e) } }; }
  }
}

export function getDevSupabase() {
  console.warn("[DEV_NO_DB] Using in-memory dev store. NOT for production. Data resets on restart.");
  return { from: (name: string) => new Query(name) };
}

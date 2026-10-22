import { DatabaseSync, type StatementSync } from 'node:sqlite';

export type Param = string | number | bigint | null | Uint8Array | boolean | undefined;
export type NamedParams = Record<string, Param>;
type Row = Record<string, unknown>;

function normalize(value: Param): string | number | bigint | null | Uint8Array {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function normalizeParams(params?: NamedParams | Param[]): unknown[] {
  if (params === undefined) return [];
  if (Array.isArray(params)) return params.map(normalize);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) out[k] = normalize(v);
  return [out];
}

/**
 * Small synchronous wrapper around node:sqlite. All methods are synchronous; the
 * main process is the only writer, so there is no cross-process contention.
 */
export class Db {
  readonly raw: DatabaseSync;
  private readonly statements = new Map<string, StatementSync>();
  private txDepth = 0;
  private closed = false;

  constructor(readonly path: string) {
    this.raw = new DatabaseSync(path);
    this.raw.exec('PRAGMA foreign_keys = ON');
    this.raw.exec('PRAGMA busy_timeout = 5000');
    if (path !== ':memory:') {
      this.raw.exec('PRAGMA journal_mode = WAL');
      this.raw.exec('PRAGMA synchronous = NORMAL');
    }
  }

  private stmt(sql: string): StatementSync {
    let s = this.statements.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.statements.set(sql, s);
    }
    return s;
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  run(sql: string, params?: NamedParams | Param[]): { changes: number } {
    const r = this.stmt(sql).run(...(normalizeParams(params) as []));
    return { changes: Number(r.changes) };
  }

  get<T = Row>(sql: string, params?: NamedParams | Param[]): T | undefined {
    return this.stmt(sql).get(...(normalizeParams(params) as [])) as T | undefined;
  }

  all<T = Row>(sql: string, params?: NamedParams | Param[]): T[] {
    return this.stmt(sql).all(...(normalizeParams(params) as [])) as T[];
  }

  /** Runs `fn` in a transaction. Nested calls use savepoints. `fn` must be synchronous. */
  tx<T>(fn: () => T): T {
    const depth = this.txDepth;
    const savepoint = `sp_${depth}`;
    this.raw.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
    this.txDepth++;
    try {
      const result = fn();
      if (result instanceof Promise) throw new Error('Db.tx callback must be synchronous');
      this.raw.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    } catch (err) {
      this.raw.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
      throw err;
    } finally {
      this.txDepth--;
    }
  }

  get userVersion(): number {
    const row = this.get<{ user_version: number }>('PRAGMA user_version');
    return row?.user_version ?? 0;
  }

  set userVersion(v: number) {
    if (!Number.isInteger(v) || v < 0) throw new Error('invalid user_version');
    this.raw.exec(`PRAGMA user_version = ${v}`);
  }

  quickCheck(): string {
    const rows = this.all<{ quick_check: string }>('PRAGMA quick_check');
    return rows.map((r) => r.quick_check).join('; ');
  }

  /** Consistent snapshot of the live database, safe while it is open. */
  backupTo(file: string): void {
    this.raw.prepare('VACUUM INTO ?').run(file);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.statements.clear();
    try {
      if (this.path !== ':memory:') this.raw.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {
      // Closing must not fail because a checkpoint could not run.
    }
    this.raw.close();
  }
}

export function bool(v: unknown): boolean {
  return v === 1 || v === true || v === '1';
}

export function json<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string' || v === '') return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/**
 * Turns free text into a safe FTS5 query: every token becomes a quoted prefix
 * term, so user input can never inject FTS operators.
 */
export function ftsQuery(input: string): string | null {
  const tokens = input
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}_]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 12);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ');
}

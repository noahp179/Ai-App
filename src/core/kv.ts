import type { Db } from './db/database';
import type { Clock } from './util';

export class KvStore {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  get<T>(key: string, fallback: T): T {
    const row = this.db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
    if (!row) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  }

  set(key: string, value: unknown): void {
    this.db.run(
      `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), this.clock.now().toISOString()],
    );
  }

  delete(key: string): void {
    this.db.run('DELETE FROM kv WHERE key = ?', [key]);
  }
}

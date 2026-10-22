import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Db } from '../../src/core/db/database';
import { migrate } from '../../src/core/db/migrations';
import type { Clock } from '../../src/core/util';

export function memoryDb(): Db {
  const db = new Db(':memory:');
  migrate(db);
  return db;
}

export function tempDir(prefix = 'fc-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A clock tests can move by hand. */
export class FakeClock implements Clock {
  private t: number;
  constructor(start: string | Date = '2026-03-01T12:00:00.000Z') {
    this.t = new Date(start).getTime();
  }
  now(): Date {
    return new Date(this.t);
  }
  set(iso: string | Date): void {
    this.t = new Date(iso).getTime();
  }
  advance(ms: number): void {
    this.t += ms;
  }
  advanceMinutes(m: number): void {
    this.t += m * 60_000;
  }
}

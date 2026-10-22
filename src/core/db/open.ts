import fs from 'node:fs';
import path from 'node:path';
import { Db } from './database';
import { LATEST_VERSION, migrate } from './migrations';

export interface OpenOptions {
  dbPath: string;
  backupDir: string;
  keepBackups: number;
  now?: () => Date;
}

export interface OpenResult {
  db: Db;
  migratedFrom: number;
  migratedTo: number;
  backupPath: string | null;
  recoveredFromCorruption: boolean;
  recoveryDetail: string | null;
}

const BACKUP_RE = /^flowcompanion-.+\.db$/;

function stamp(d: Date): string {
  return d.toISOString().replace(/[:.]/g, '-');
}

export function listBackups(backupDir: string): { file: string; path: string; size: number; createdAt: string }[] {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter((f) => BACKUP_RE.test(f))
    .map((f) => {
      const p = path.join(backupDir, f);
      const st = fs.statSync(p);
      return { file: f, path: p, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.file.localeCompare(a.file)));
}

export function pruneBackups(backupDir: string, keep: number): void {
  for (const b of listBackups(backupDir).slice(Math.max(1, keep))) {
    try {
      fs.rmSync(b.path);
    } catch {
      // A backup we cannot delete is not worth failing startup over.
    }
  }
}

function isHealthy(file: string): boolean {
  let db: Db | null = null;
  try {
    db = new Db(file);
    return db.quickCheck() === 'ok';
  } catch {
    return false;
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}

function moveAside(file: string, suffix: string): void {
  for (const ext of ['', '-wal', '-shm']) {
    const p = file + ext;
    if (fs.existsSync(p)) fs.renameSync(p, `${p}.${suffix}`);
  }
}

export function createBackup(db: Db, backupDir: string, label: string, now: Date, keep: number): string {
  fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, `flowcompanion-${label}-${stamp(now)}.db`);
  db.backupTo(file);
  pruneBackups(backupDir, keep);
  return file;
}

/**
 * Opens the app database. If the file is unreadable it is moved aside (never
 * deleted) and the newest healthy backup is restored; if there is none, a new
 * empty database is created and the report says so.
 */
export function openDatabase(opts: OpenOptions): OpenResult {
  const now = opts.now ?? (() => new Date());
  fs.mkdirSync(path.dirname(opts.dbPath), { recursive: true });
  fs.mkdirSync(opts.backupDir, { recursive: true });

  let recovered = false;
  let recoveryDetail: string | null = null;
  const existed = fs.existsSync(opts.dbPath);

  if (existed && !isHealthy(opts.dbPath)) {
    recovered = true;
    const suffix = `corrupt-${stamp(now())}`;
    moveAside(opts.dbPath, suffix);
    const backup = listBackups(opts.backupDir).find((b) => isHealthy(b.path));
    if (backup) {
      fs.copyFileSync(backup.path, opts.dbPath);
      recoveryDetail = `The database could not be read. It was moved to ${path.basename(opts.dbPath)}.${suffix} and the backup ${backup.file} was restored.`;
    } else {
      recoveryDetail = `The database could not be read and no healthy backup exists. It was moved to ${path.basename(opts.dbPath)}.${suffix} and a new, empty database was created.`;
    }
  }

  const db = new Db(opts.dbPath);
  let backupPath: string | null = null;
  const current = db.userVersion;
  if (existed && current > 0 && current < LATEST_VERSION) {
    backupPath = createBackup(db, opts.backupDir, `pre-migration-v${current}`, now(), opts.keepBackups);
  }
  const { from, to } = migrate(db);
  return {
    db,
    migratedFrom: from,
    migratedTo: to,
    backupPath,
    recoveredFromCorruption: recovered,
    recoveryDetail,
  };
}

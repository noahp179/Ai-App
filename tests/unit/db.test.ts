import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Db, ftsQuery } from '../../src/core/db/database';
import { LATEST_VERSION, MIGRATIONS, MigrationError, migrate } from '../../src/core/db/migrations';
import { listBackups, openDatabase } from '../../src/core/db/open';
import { tempDir } from '../helpers/db';

describe('migrations', () => {
  it('migrates an empty database to the latest version', () => {
    const db = new Db(':memory:');
    const r = migrate(db);
    expect(r).toEqual({ from: 0, to: LATEST_VERSION });
    const tables = db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((t) => t.name);
    for (const t of ['kv', 'notes', 'tasks', 'events', 'messages', 'prompts', 'listings', 'feed_items', 'study_sessions']) {
      expect(tables).toContain(t);
    }
  });

  it('is idempotent', () => {
    const db = new Db(':memory:');
    migrate(db);
    expect(migrate(db)).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION });
  });

  it('upgrades a database left at an intermediate version', () => {
    const db = new Db(':memory:');
    migrate(db, MIGRATIONS.slice(0, 3));
    expect(db.userVersion).toBe(3);
    db.run("INSERT INTO notes (id, title, body, created_at, updated_at) VALUES ('n1', 'Kept', 'body', 'x', 'x')");
    migrate(db);
    expect(db.userVersion).toBe(LATEST_VERSION);
    expect(db.get<{ title: string }>("SELECT title FROM notes WHERE id = 'n1'")?.title).toBe('Kept');
  });

  it('rolls back a failing migration and keeps the last good version', () => {
    const db = new Db(':memory:');
    const broken = [
      ...MIGRATIONS.slice(0, 2),
      { version: 3, name: 'broken', up: (d: Db) => d.exec('CREATE TABLE partial (x); SELECT * FROM no_such_table;') },
    ];
    expect(() => migrate(db, broken)).toThrow(MigrationError);
    expect(db.userVersion).toBe(2);
    expect(db.all("SELECT name FROM sqlite_master WHERE name = 'partial'")).toHaveLength(0);
  });

  it('refuses a database from a newer app version', () => {
    const db = new Db(':memory:');
    db.userVersion = LATEST_VERSION + 5;
    expect(() => migrate(db)).toThrow(/newer FlowCompanion/);
  });

  it('keeps the search index in sync through triggers', () => {
    const db = new Db(':memory:');
    migrate(db);
    db.run("INSERT INTO notes (id, title, body, created_at, updated_at) VALUES ('n1', 'Quarterly plan', 'budget review', 'x', 'x')");
    const q = "SELECT ref_id FROM search_index WHERE search_index MATCH ? AND type = 'note'";
    expect(db.all(q, [ftsQuery('budg')!])).toHaveLength(1);
    db.run("UPDATE notes SET body = 'roadmap' WHERE id = 'n1'");
    expect(db.all(q, [ftsQuery('budget')!])).toHaveLength(0);
    expect(db.all(q, [ftsQuery('roadmap')!])).toHaveLength(1);
    db.run("UPDATE notes SET deleted_at = 'x' WHERE id = 'n1'");
    expect(db.all(q, [ftsQuery('roadmap')!])).toHaveLength(0);
    db.run("DELETE FROM notes WHERE id = 'n1'");
    expect(db.all('SELECT * FROM search_index')).toHaveLength(0);
  });
});

describe('ftsQuery', () => {
  it('quotes tokens so operators cannot be injected', () => {
    expect(ftsQuery('hello world')).toBe('"hello"* "world"*');
    expect(ftsQuery('a" OR b NEAR(')).toBe('"a"* "OR"* "b"* "NEAR"*');
    expect(ftsQuery('   ')).toBeNull();
  });
});

describe('transactions', () => {
  it('rolls back nested savepoints independently', () => {
    const db = new Db(':memory:');
    migrate(db);
    db.tx(() => {
      db.run("INSERT INTO kv VALUES ('a', '1', 'x')");
      expect(() =>
        db.tx(() => {
          db.run("INSERT INTO kv VALUES ('b', '1', 'x')");
          throw new Error('inner');
        }),
      ).toThrow('inner');
    });
    expect(db.all('SELECT key FROM kv').map((r) => (r as { key: string }).key)).toEqual(['a']);
  });
});

describe('openDatabase', () => {
  it('creates a fresh database and persists across reopen', () => {
    const dir = tempDir();
    const dbPath = path.join(dir, 'app.db');
    const first = openDatabase({ dbPath, backupDir: path.join(dir, 'backups'), keepBackups: 3 });
    expect(first.migratedFrom).toBe(0);
    first.db.run("INSERT INTO kv VALUES ('k', '\"v\"', 'x')");
    first.db.close();
    const second = openDatabase({ dbPath, backupDir: path.join(dir, 'backups'), keepBackups: 3 });
    expect(second.migratedFrom).toBe(LATEST_VERSION);
    expect(second.backupPath).toBeNull();
    expect(second.db.get<{ value: string }>("SELECT value FROM kv WHERE key = 'k'")?.value).toBe('"v"');
    second.db.close();
  });

  it('backs up before migrating an older database', () => {
    const dir = tempDir();
    const dbPath = path.join(dir, 'app.db');
    const old = new Db(dbPath);
    migrate(old, MIGRATIONS.slice(0, 4));
    old.close();
    const r = openDatabase({ dbPath, backupDir: path.join(dir, 'backups'), keepBackups: 3 });
    expect(r.migratedFrom).toBe(4);
    expect(r.backupPath).toMatch(/pre-migration-v4/);
    expect(fs.existsSync(r.backupPath!)).toBe(true);
    const backup = new Db(r.backupPath!);
    expect(backup.userVersion).toBe(4);
    backup.close();
    r.db.close();
  });

  it('moves a corrupt database aside and restores the newest healthy backup', () => {
    const dir = tempDir();
    const dbPath = path.join(dir, 'app.db');
    const backupDir = path.join(dir, 'backups');
    const first = openDatabase({ dbPath, backupDir, keepBackups: 3 });
    first.db.run("INSERT INTO kv VALUES ('saved', '1', 'x')");
    first.db.backupTo(path.join(backupDir, 'flowcompanion-manual-1.db'));
    first.db.close();
    fs.writeFileSync(dbPath, Buffer.from('this is definitely not sqlite'.repeat(200)));
    for (const ext of ['-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });

    const r = openDatabase({ dbPath, backupDir, keepBackups: 3 });
    expect(r.recoveredFromCorruption).toBe(true);
    expect(r.recoveryDetail).toMatch(/was restored/);
    expect(r.db.get("SELECT * FROM kv WHERE key = 'saved'")).toBeTruthy();
    expect(fs.readdirSync(dir).some((f) => f.includes('.corrupt-'))).toBe(true);
    r.db.close();
  });

  it('starts empty, and says so, when corrupt with no backup', () => {
    const dir = tempDir();
    const dbPath = path.join(dir, 'app.db');
    fs.writeFileSync(dbPath, Buffer.alloc(8192, 7));
    const r = openDatabase({ dbPath, backupDir: path.join(dir, 'backups'), keepBackups: 3 });
    expect(r.recoveredFromCorruption).toBe(true);
    expect(r.recoveryDetail).toMatch(/no healthy backup/);
    expect(r.db.userVersion).toBe(LATEST_VERSION);
    r.db.close();
  });

  it('prunes old backups beyond the configured count', () => {
    const dir = tempDir();
    const backupDir = path.join(dir, 'b');
    fs.mkdirSync(backupDir);
    for (let i = 0; i < 6; i++) {
      const p = path.join(backupDir, `flowcompanion-x-${i}.db`);
      fs.writeFileSync(p, 'x');
      fs.utimesSync(p, new Date(2026, 0, i + 1), new Date(2026, 0, i + 1));
    }
    const db = new Db(':memory:');
    migrate(db);
    db.close();
    const r = openDatabase({ dbPath: path.join(dir, 'a.db'), backupDir, keepBackups: 2 });
    r.db.close();
    // Fresh database: no migration backup, existing backups untouched.
    expect(listBackups(backupDir)).toHaveLength(6);
  });
});

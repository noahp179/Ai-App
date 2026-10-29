import { describe, expect, it } from 'vitest';
import { DataService } from '../../src/core/data';
import { NotesService } from '../../src/core/notes';
import { SecretStore } from '../../src/core/secrets';
import { fakeCipher } from '../helpers/ai';
import { FakeClock, memoryDb } from '../helpers/db';

describe('data export and inventory', () => {
  it('exports user data but never secrets', () => {
    const db = memoryDb();
    const clock = new FakeClock();
    new NotesService(db, clock).create({ title: 'Mine', body: 'hello' });
    new SecretStore(db, fakeCipher(), clock).set('provider:x:apiKey', 'sk-very-secret');
    const data = new DataService(db);
    const out = data.exportAll(clock.now(), 'test');
    expect(JSON.stringify(out)).not.toContain('sk-very-secret');
    expect((out.tables as Record<string, unknown[]>).notes).toHaveLength(1);
    expect(out.tables).not.toHaveProperty('secrets');
    expect(data.inventory().find((t) => t.table === 'notes')?.rows).toBe(1);
    expect(data.inventory().find((t) => t.table === 'secrets')?.rows).toBe(1);
  });

  it('leaves Student Learning profiles out of the app-wide export, which anyone on the computer can run', () => {
    const db = memoryDb();
    const clock = new FakeClock();
    const now = clock.now().toISOString();
    db.run('INSERT INTO students (id, display_name, grade, profile, pin_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['s1', 'Private Kid', 7, '{}', 'scrypt$hash', now, now]);
    const data = new DataService(db);
    const out = data.exportAll(clock.now(), 'test');
    const tables = Object.keys(out.tables as Record<string, unknown>);
    expect(tables).not.toContain('students');
    expect(tables.filter((t) => t.startsWith('study_') && t !== 'study_sessions')).toEqual([]);
    expect(JSON.stringify(out)).not.toContain('Private Kid');
    expect(JSON.stringify(out)).not.toContain('scrypt$hash');
    expect(data.inventory().find((t) => t.table === 'students')?.rows).toBe(1);
  });
});

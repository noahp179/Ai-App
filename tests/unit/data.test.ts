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
});

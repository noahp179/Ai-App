import { AiTasksService } from '../../src/core/aitasks';
import { AiService } from '../../src/core/ai/service';
import { KvStore } from '../../src/core/kv';
import { type Cipher, SecretStore } from '../../src/core/secrets';
import { SettingsService } from '../../src/core/settings';
import type { AiStreamEvent, Conversation, Message } from '../../src/shared/types';
import { FakeClock, memoryDb } from './db';

export const fakeCipher = (secure = true): Cipher => ({
  isSecure: () => secure,
  encrypt: (s) => Buffer.from(`enc:${s}`),
  decrypt: (b) => Buffer.from(b).toString().slice(4),
});

export function aiSetup(opts: { fetch?: typeof fetch; secure?: boolean; focused?: boolean } = {}) {
  const db = memoryDb();
  const clock = new FakeClock();
  const settings = new SettingsService(new KvStore(db, clock));
  const secrets = new SecretStore(db, fakeCipher(opts.secure ?? true), clock);
  const tasks = new AiTasksService(db, clock);
  const events: AiStreamEvent[] = [];
  const notified: { c: Conversation; m: Message }[] = [];
  let tutor: string | null = null;
  const ai = new AiService({
    db,
    clock,
    secrets,
    settings: () => settings.get(),
    tasks,
    fetch: opts.fetch ?? fetch,
    emitStream: (e) => events.push(e),
    emitChanged: () => {},
    notifyDone: (c, m) => notified.push({ c, m }),
    isFocused: () => opts.focused ?? true,
    resolveAttachment: (a) => (a.id === 'note-1' ? { label: 'note: Trip plan', text: 'Lisbon in May' } : null),
    extraSystemPrompt: () => tutor,
  });
  return { db, clock, settings, secrets, tasks, ai, events, notified, setTutor: (t: string | null) => (tutor = t) };
}

import type { Db } from './db/database';
import type { Clock } from './util';

/** OS-backed encryption, provided by Electron's safeStorage in the app and a fake in tests. */
export interface Cipher {
  /** True only when encryption is backed by the OS keychain/keyring, not an obfuscation fallback. */
  isSecure(): boolean;
  encrypt(plain: string): Uint8Array;
  decrypt(data: Uint8Array): string;
}

export type SecretStorage = 'secure' | 'session';

/**
 * Stores credentials such as API keys. Values are written to disk only when the
 * OS can encrypt them; otherwise they live in memory for this session and the
 * caller is told so. Secret values are never logged or returned to the UI.
 */
export class SecretStore {
  private readonly session = new Map<string, string>();

  constructor(
    private readonly db: Db,
    private readonly cipher: Cipher,
    private readonly clock: Clock,
  ) {}

  get secureAvailable(): boolean {
    return this.cipher.isSecure();
  }

  set(name: string, value: string): SecretStorage {
    if (this.cipher.isSecure()) {
      const enc = this.cipher.encrypt(value);
      this.db.run(
        `INSERT INTO secrets (name, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [name, enc, this.clock.now().toISOString()],
      );
      this.session.delete(name);
      return 'secure';
    }
    this.session.set(name, value);
    this.db.run('DELETE FROM secrets WHERE name = ?', [name]);
    return 'session';
  }

  get(name: string): string | null {
    const mem = this.session.get(name);
    if (mem !== undefined) return mem;
    const row = this.db.get<{ value: Uint8Array }>('SELECT value FROM secrets WHERE name = ?', [name]);
    if (!row) return null;
    try {
      return this.cipher.decrypt(row.value);
    } catch {
      // Unreadable (keychain reset, different OS user). Treat as missing.
      return null;
    }
  }

  has(name: string): boolean {
    return this.session.has(name) || this.db.get('SELECT 1 FROM secrets WHERE name = ?', [name]) !== undefined;
  }

  storageOf(name: string): SecretStorage | 'none' {
    if (this.session.has(name)) return 'session';
    return this.db.get('SELECT 1 FROM secrets WHERE name = ?', [name]) ? 'secure' : 'none';
  }

  delete(name: string): void {
    this.session.delete(name);
    this.db.run('DELETE FROM secrets WHERE name = ?', [name]);
  }

  deletePrefix(prefix: string): void {
    for (const k of [...this.session.keys()]) if (k.startsWith(prefix)) this.session.delete(k);
    this.db.run("DELETE FROM secrets WHERE substr(name, 1, length(?)) = ?", [prefix, prefix]);
  }
}

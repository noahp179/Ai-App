import fs from 'node:fs';
import path from 'node:path';
import { decrypt, encrypt } from './crypto';

/** Where uploaded files live. Keys look like "classId/materialId/v1". */
export interface Storage {
  readonly name: string;
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Removes everything under a prefix (a class or a material). Returns how many objects went. */
  deletePrefix(prefix: string): Promise<number>;
  list(prefix: string): Promise<string[]>;
}

const SAFE = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)*$/;

/**
 * Files on local disk, each encrypted with AES-256-GCM before it is written. For development and single-server
 * deployments. An S3-compatible adapter would implement the same interface (not included; see KNOWN_LIMITATIONS).
 */
export class LocalEncryptedStorage implements Storage {
  readonly name = 'local disk (encrypted)';
  constructor(
    private readonly dir: string,
    private readonly key: Buffer,
  ) {
    fs.mkdirSync(dir, { recursive: true });
  }

  private file(key: string): string {
    if (!SAFE.test(key) || key.includes('..')) throw new Error('Invalid storage key');
    return path.join(this.dir, key);
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const f = this.file(key);
    await fs.promises.mkdir(path.dirname(f), { recursive: true });
    await fs.promises.writeFile(f, encrypt(this.key, bytes), { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    return decrypt(this.key, await fs.promises.readFile(this.file(key)));
  }

  async delete(key: string): Promise<void> {
    await fs.promises.rm(this.file(key), { force: true });
  }

  async list(prefix: string): Promise<string[]> {
    const root = this.file(prefix);
    const out: string[] = [];
    const walk = async (d: string) => {
      for (const e of await fs.promises.readdir(d, { withFileTypes: true }).catch(() => [])) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else out.push(path.relative(this.dir, p).split(path.sep).join('/'));
      }
    };
    await walk(root);
    return out;
  }

  async deletePrefix(prefix: string): Promise<number> {
    const n = (await this.list(prefix)).length;
    await fs.promises.rm(this.file(prefix), { recursive: true, force: true });
    return n;
  }
}

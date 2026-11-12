import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The server's master key: from FC_CLASSROOM_KEY (32 bytes, base64) or a key file created next to the data on
 * first start (mode 0600). It encrypts stored files and the school's AI key, and signs download links.
 */
export function loadMasterKey(dataDir: string, fromEnv?: string | null): Buffer {
  if (fromEnv) {
    const k = Buffer.from(fromEnv, 'base64');
    if (k.length !== 32) throw new Error('FC_CLASSROOM_KEY must be 32 bytes, base64-encoded.');
    return k;
  }
  const file = path.join(dataDir, 'master.key');
  if (fs.existsSync(file)) return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  const k = randomBytes(32);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, k.toString('base64'), { mode: 0o600 });
  return k;
}

/** AES-256-GCM. Output: 12-byte nonce, 16-byte tag, ciphertext. */
export function encrypt(key: Buffer, plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

export function decrypt(key: Buffer, data: Buffer): Buffer {
  const d = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  d.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([d.update(data.subarray(28)), d.final()]);
}

export const encryptText = (key: Buffer, s: string): string => encrypt(key, Buffer.from(s, 'utf8')).toString('base64');
export const decryptText = (key: Buffer, s: string): string => decrypt(key, Buffer.from(s, 'base64')).toString('utf8');

/** Signs "what|expiry" for short-lived download links. */
export function sign(key: Buffer, what: string, expires: number): string {
  return createHmac('sha256', key).update(`${what}|${expires}`).digest('base64url');
}
export function verifySignature(key: Buffer, what: string, expires: number, sig: string, now: number): boolean {
  if (!Number.isFinite(expires) || expires < now) return false;
  const a = Buffer.from(sign(key, what, expires));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

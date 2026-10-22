import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const N = 16384;

/** scrypt hash with a random salt, in the form scrypt$N$salt$hash. */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, 32, { N });
  return `scrypt$${N}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [alg, n, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(secret, Buffer.from(salt, 'base64'), expected.length, { N: Number(n) });
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Human-friendly random code without look-alike characters, e.g. "K7QM-9XRT-…". */
export function randomCode(groups: number, size = 4): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(groups * size);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return Array.from({ length: groups }, (_, g) => chars.slice(g * size, g * size + size).join('')).join('-');
}

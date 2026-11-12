import { inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  size: number;
  read(): Buffer;
}

const MAX_ENTRIES = 5000;
const MAX_ENTRY = 60 * 1024 * 1024;
const MAX_TOTAL = 250 * 1024 * 1024;

/**
 * Reads a ZIP archive's central directory (enough for .docx and .pptx). Refuses archives that are too big when
 * unpacked, encrypted entries and anything it does not understand, instead of guessing.
 */
export function readZip(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (count > MAX_ENTRIES) throw new Error('Too many files in the archive');
  const entries: ZipEntry[] = [];
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) throw new Error('Damaged ZIP directory');
    const flags = buf.readUInt16LE(off + 8);
    const method = buf.readUInt16LE(off + 10);
    const compressed = buf.readUInt32LE(off + 20);
    const size = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    off += 46 + nameLen + extraLen + commentLen;
    if (flags & 1) throw new Error('The file is password-protected');
    if (size > MAX_ENTRY || (total += size) > MAX_TOTAL) throw new Error('The file is too large when unpacked');
    entries.push({
      name,
      size,
      read() {
        if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('Damaged ZIP entry');
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const data = buf.subarray(start, start + compressed);
        if (method === 0) return Buffer.from(data);
        if (method !== 8) throw new Error('Unsupported ZIP compression');
        const out = inflateRawSync(data, { maxOutputLength: MAX_ENTRY });
        if (out.length !== size) throw new Error('Damaged ZIP entry');
        return out;
      },
    });
  }
  return entries;
}

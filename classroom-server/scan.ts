import net from 'node:net';
import { MATERIAL_TYPES } from '../src/shared/classroom/protocol';
import { readZip } from './zip';

export type ScanResult = { ok: true } | { ok: false; reason: string };
export interface Scanner {
  /** engine: a real antivirus engine checked the file. basic: only the built-in checks ran. */
  readonly level: 'engine' | 'basic';
  readonly label: string;
  scan(bytes: Buffer, name: string): Promise<ScanResult>;
}

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const EXECUTABLE = /\.(exe|dll|scr|bat|cmd|com|msi|js|jse|vbs|vbe|wsf|ps1|jar|lnk|hta|sh|app)$/i;

export function extensionOf(name: string): string {
  return /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
}

/** Does the content look like what its extension says? */
export function matchesType(bytes: Buffer, ext: string): boolean {
  const head = bytes.subarray(0, 8);
  switch (ext) {
    case 'pdf':
      return bytes.subarray(0, 1024).includes('%PDF-');
    case 'docx':
    case 'pptx':
      return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 3 || head[2] === 5);
    case 'png':
      return head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'jpg':
    case 'jpeg':
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'txt':
    case 'md':
      // Text: no NUL bytes in the first 64 KB.
      return !bytes.subarray(0, 65536).includes(0);
    default:
      return false;
  }
}

/**
 * Built-in checks, used alone when no antivirus engine is configured: the file type must match its extension,
 * no macros or programs inside Office files, no scripts or launch actions in PDFs, and the EICAR test file is
 * refused. This is not an antivirus engine and is reported as "basic checks" wherever scan results are shown.
 */
export function basicChecks(bytes: Buffer, name: string): ScanResult {
  const ext = extensionOf(name);
  if (!MATERIAL_TYPES[ext]) return { ok: false, reason: `Files of type .${ext || '?'} are not accepted. Use PDF, DOCX, PPTX, TXT, MD, PNG or JPG.` };
  if (!matchesType(bytes, ext)) return { ok: false, reason: `This file’s contents do not match its .${ext} extension.` };
  if (bytes.includes(EICAR)) return { ok: false, reason: 'The file matched an antivirus test signature.' };
  if (ext === 'docx' || ext === 'pptx') {
    try {
      const entries = readZip(bytes);
      if (entries.some((e) => /vbaProject\.bin$/i.test(e.name))) return { ok: false, reason: 'The file contains macros. Save it without macros and upload it again.' };
      const bad = entries.find((e) => EXECUTABLE.test(e.name));
      if (bad) return { ok: false, reason: 'The file contains an embedded program.' };
      const want = ext === 'docx' ? 'word/document.xml' : 'ppt/presentation.xml';
      if (!entries.some((e) => e.name === want)) return { ok: false, reason: `This is not a valid .${ext} file.` };
    } catch (err) {
      return { ok: false, reason: `The file could not be opened (${err instanceof Error ? err.message : 'damaged'}).` };
    }
  }
  if (ext === 'pdf' && /\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(bytes.toString('latin1'))) return { ok: false, reason: 'The PDF contains scripts, launch actions or embedded files. Print it to a new PDF and upload that.' };
  return { ok: true };
}

export const basicScanner: Scanner = {
  level: 'basic',
  label: 'Basic checks only (no antivirus engine configured)',
  scan: async (bytes, name) => basicChecks(bytes, name),
};

/** ClamAV over its INSTREAM protocol, after the basic checks. Fails closed: if the engine cannot be reached, the upload is refused. */
export function clamdScanner(host: string, port: number, timeoutMs = 20_000): Scanner {
  return {
    level: 'engine',
    label: `ClamAV (${host}:${port}) and basic checks`,
    async scan(bytes, name) {
      const basic = basicChecks(bytes, name);
      if (!basic.ok) return basic;
      return new Promise<ScanResult>((resolve) => {
        const sock = net.createConnection({ host, port });
        let reply = '';
        const done = (r: ScanResult) => {
          sock.destroy();
          resolve(r);
        };
        sock.setTimeout(timeoutMs, () => done({ ok: false, reason: 'The antivirus scan timed out, so the file was not accepted. Try again.' }));
        sock.on('error', () => done({ ok: false, reason: 'The antivirus scanner could not be reached, so the file was not accepted. Try again later.' }));
        sock.on('data', (d) => (reply += d.toString('utf8')));
        sock.on('end', () => {
          if (/\bOK\b/.test(reply) && !/FOUND/.test(reply)) done({ ok: true });
          else if (/FOUND/.test(reply)) done({ ok: false, reason: 'The antivirus scanner flagged this file.' });
          else done({ ok: false, reason: 'The antivirus scanner gave an unexpected answer, so the file was not accepted.' });
        });
        sock.on('connect', () => {
          sock.write('zINSTREAM\0');
          for (let i = 0; i < bytes.length; i += 65536) {
            const chunk = bytes.subarray(i, i + 65536);
            const len = Buffer.alloc(4);
            len.writeUInt32BE(chunk.length);
            sock.write(len);
            sock.write(chunk);
          }
          sock.write(Buffer.alloc(4));
        });
      });
    },
  };
}

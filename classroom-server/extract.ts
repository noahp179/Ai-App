import { extensionOf } from './scan';
import { readZip } from './zip';

export interface Extraction {
  /** One entry per page or slide; text files and Word files without page breaks are split into sections. */
  pages: string[];
  status: 'ready' | 'unreadable';
  detail: string;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
const clean = (s: string) => s.replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const SECTION = 3000;
/** Splits long text into sections at paragraph boundaries, so citations can point somewhere useful. */
function sections(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const para of text.split(/\n{2,}/)) {
    if (cur && cur.length + para.length > SECTION) {
      out.push(cur.trim());
      cur = '';
    }
    cur += (cur ? '\n\n' : '') + para;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function docx(bytes: Buffer): string[] {
  const xml = readZip(bytes).find((e) => e.name === 'word/document.xml')?.read().toString('utf8');
  if (!xml) throw new Error('No document text found');
  const pages: string[] = [''];
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []) {
    let text = '';
    for (const m of p.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b([^>]*)\/>|<w:lastRenderedPageBreak\/>/g)) {
      if (m[1] !== undefined) text += decode(m[1]);
      else if (m[2] === 'tab') text += '\t';
      else if (m[2] === 'br' && /w:type="page"/.test(m[3] ?? '')) {
        pages[pages.length - 1] += text;
        text = '';
        pages.push('');
      } else if (m[2]) text += '\n';
      else if (pages[pages.length - 1]!.trim() || text.trim()) {
        pages[pages.length - 1] += text;
        text = '';
        pages.push('');
      }
    }
    pages[pages.length - 1] += `${text}\n\n`;
  }
  const real = pages.map(clean).filter(Boolean);
  // No page breaks recorded in the file: fall back to sections.
  return real.length > 1 ? real : sections(real[0] ?? '');
}

function pptx(bytes: Buffer): string[] {
  const entries = readZip(bytes);
  const get = (n: string) => entries.find((e) => e.name === n)?.read().toString('utf8') ?? '';
  const rels = new Map([...get('ppt/_rels/presentation.xml.rels').matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map((m) => [m[1]!, m[2]!]));
  let order = [...get('ppt/presentation.xml').matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => rels.get(m[1]!)).filter((t): t is string => !!t).map((t) => `ppt/${t.replace(/^\/?(ppt\/)?/, '')}`);
  if (!order.length) order = entries.map((e) => e.name).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  return order.map((name) => {
    const xml = get(name);
    return clean((xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? []).map((p) => [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decode(m[1]!)).join('')).join('\n'));
  });
}

async function pdf(bytes: Buffer): Promise<string[]> {
  // pdf.js is ESM-only; load it on demand (it stays outside the server bundle).
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as typeof import('pdfjs-dist');
  // pdf.js 6 or later: earlier versions could run JavaScript from a crafted PDF (GHSA-hq66-cqwq-w95j).
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const it of content.items) {
        if (!('str' in it)) continue;
        text += it.str + (it.hasEOL ? '\n' : '');
      }
      pages.push(clean(text));
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

/** Extracts text with page or slide numbers. Never reports text that is not in the file. */
export async function extractText(bytes: Buffer, name: string): Promise<Extraction> {
  const ext = extensionOf(name);
  try {
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return { pages: [], status: 'unreadable', detail: 'Image: stored and can be opened, but it has no text, so the AI assistant cannot quote it.' };
    const pages = ext === 'pdf' ? await pdf(bytes) : ext === 'docx' ? docx(bytes) : ext === 'pptx' ? pptx(bytes) : sections(clean(bytes.toString('utf8')));
    const chars = pages.reduce((a, p) => a + p.length, 0);
    if (chars < 20) {
      return {
        pages: [],
        status: 'unreadable',
        detail: ext === 'pdf' ? 'Text could not be read. This looks like a scanned PDF (pictures of pages). Upload a version with selectable text.' : 'No text was found in this file.',
      };
    }
    const unit = ext === 'pptx' ? 'slide' : ext === 'pdf' ? 'page' : pages.length > 1 && ext === 'docx' ? 'page or section' : 'section';
    return { pages, status: 'ready', detail: `${pages.length} ${unit}${pages.length === 1 ? '' : 's'} read.` };
  } catch (err) {
    return { pages: [], status: 'unreadable', detail: `Text could not be read (${err instanceof Error ? err.message.slice(0, 120) : 'unknown error'}).` };
  }
}

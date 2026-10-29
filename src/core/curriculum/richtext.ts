/**
 * Converts the Ministry's rich text into a small, safe HTML subset and a plain-text copy, without changing
 * any wording. Glossary links become plain spans; images, embedded items and tables are left out and flagged
 * so the UI can point to the Ministry page instead.
 */

const KEEP = new Set(['p', 'ul', 'ol', 'li', 'em', 'strong', 'sup', 'sub', 'br']);
const RENAME: Record<string, string> = { b: 'strong', i: 'em', h1: 'p', h2: 'p', h3: 'p', h4: 'p', h5: 'p', h6: 'p', a: 'span' };
/** Dropped together with everything inside them. */
const DROP_WITH_CONTENT = new Set(['figure', 'object', 'table', 'script', 'style', 'iframe', 'svg', 'video', 'audio', 'noscript', 'template']);
const VOID_DROPPED = new Set(['img', 'hr', 'input', 'source', 'wbr']);
const BLOCK = new Set(['p', 'li', 'ul', 'ol', 'br']);

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', times: '×', divide: '÷', deg: '°', minus: '−' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ' };
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '−': '₋' };
function script(text: string, map: Record<string, string>, fallback: string): string {
  const t = text.trim();
  if (t && [...t].every((ch) => map[ch])) return [...t].map((ch) => map[ch]).join('');
  return t ? `${fallback}(${t})` : '';
}

export interface Sanitized {
  html: string;
  text: string;
  omittedMedia: boolean;
}

interface Frame {
  tag: string;
  textStart: number;
}

export function sanitizeRichText(input: string | null | undefined): Sanitized {
  const src = input ?? '';
  const tokens = src.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>|[^<]+|</g) ?? [];
  let html = '';
  const textParts: string[] = [];
  const stack: Frame[] = [];
  let dropDepth = 0;
  let dropTag = '';
  let omitted = false;
  let listDepth = 0;
  let pendingBullet = false;
  /** True right after a block tag, where whitespace-only text is just source formatting. */
  let atBlockEdge = true;

  const pushText = (raw: string) => {
    // Line breaks in the source are only layout; HTML treats them as spaces.
    const decoded = decodeEntities(raw.replace(/[\t\n\r ]+/g, ' '));
    if (!decoded || (decoded === ' ' && atBlockEdge)) return;
    atBlockEdge = false;
    html += escapeHtml(decoded);
    if (pendingBullet) {
      // \u0001 marks indentation, so trimming the source's own whitespace does not remove it.
      textParts.push(`${'\u0001'.repeat(Math.max(0, listDepth - 1))}- `);
      pendingBullet = false;
    }
    textParts.push(decoded);
  };

  for (const tok of tokens) {
    if (tok.startsWith('<!--')) continue;
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>$/.exec(tok);
    if (!m) {
      if (dropDepth === 0) pushText(tok);
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2]!.toLowerCase();
    if (dropDepth > 0) {
      if (name === dropTag) dropDepth += closing ? -1 : tok.endsWith('/>') ? 0 : 1;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      omitted = true;
      if (!closing && !tok.endsWith('/>')) {
        dropDepth = 1;
        dropTag = name;
      }
      continue;
    }
    if (VOID_DROPPED.has(name)) {
      if (name === 'img') omitted = true;
      continue;
    }
    const tag = RENAME[name] ?? name;
    if (!KEEP.has(tag) && tag !== 'span') continue; // unknown wrappers (div, figcaption…) keep their text only
    if (tag === 'br') {
      html += '<br>';
      textParts.push('\n');
      atBlockEdge = true;
      continue;
    }
    if (BLOCK.has(tag)) {
      atBlockEdge = true;
      // A block that opens mid-line (a list inside a list item) starts on its own line in the plain text.
      if (!closing && textParts.length && !textParts[textParts.length - 1]!.endsWith('\n')) textParts.push('\n');
    }
    if (!closing) {
      const heading = /^h[1-6]$/.test(name);
      html += tag === 'span' ? '<span class="term">' : `<${tag}>`;
      if (heading) html += '<strong>';
      stack.push({ tag: heading ? 'p+strong' : tag, textStart: textParts.length });
      if (tag === 'ul' || tag === 'ol') listDepth++;
      if (tag === 'li') pendingBullet = true;
      continue;
    }
    // Closing: pop to the matching frame, closing anything left open inside it.
    const want = /^h[1-6]$/.test(name) ? 'p+strong' : tag;
    const at = stack.map((f) => f.tag).lastIndexOf(want);
    if (at < 0) continue;
    while (stack.length > at) {
      const f = stack.pop()!;
      const sub = textParts.splice(f.textStart);
      if (f.tag === 'sup') textParts.push(script(sub.join(''), SUP, '^'));
      else if (f.tag === 'sub') textParts.push(script(sub.join(''), SUB, '_'));
      else textParts.push(...sub);
      html += f.tag === 'p+strong' ? '</strong></p>' : f.tag === 'span' ? '</span>' : `</${f.tag}>`;
      if (f.tag === 'ul' || f.tag === 'ol') listDepth = Math.max(0, listDepth - 1);
      if (BLOCK.has(f.tag) || f.tag === 'p+strong') textParts.push('\n');
    }
  }
  while (stack.length) {
    const f = stack.pop()!;
    html += f.tag === 'p+strong' ? '</strong></p>' : f.tag === 'span' ? '</span>' : `</${f.tag}>`;
  }
  const text = textParts
    .join('')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    // eslint-disable-next-line no-control-regex -- \u0001 marks list nesting depth
    .map((l) => l.replace(/[ \t]+/g, ' ').replace(/ +([,.;:)])/g, '$1').trim().replace(/^\u0001+/, (m) => '  '.repeat(m.length)))
    .filter((l, i, all) => l !== '' || (i > 0 && all[i - 1] !== ''))
    .join('\n')
    .trim();
  return { html: html.replace(/<p>\s*<\/p>|<p><br><\/p>/g, '').trim(), text, omittedMedia: omitted };
}

/** Plain text of a list of <li> items (prerequisites), each kept verbatim. */
export function listItems(input: string | null | undefined): string[] {
  const out: string[] = [];
  for (const m of (input ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const t = sanitizeRichText(m[1]).text.replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  if (!out.length) {
    const t = sanitizeRichText(input).text.replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}

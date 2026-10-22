import {
  CROWN_COPYRIGHT_TERMS,
  CURRICULUM_FORMAT,
  DCP_API,
  DCP_SITE,
  type CurriculumBundle,
  type CurriculumCourse,
  type CurriculumDocument,
  type CurriculumExpectation,
  type CurriculumStrand,
  type SourceLink,
  type Support,
} from '../../shared/curriculum/types';
import { listItems, sanitizeRichText } from './richtext';

/**
 * Reads the Ontario Ministry of Education's Curriculum and Resources site (dcp.edu.gov.on.ca) through the
 * public content API that the site itself uses, and turns it into a normalized bundle. Only curriculum
 * documents linked from the live "Curriculum" page are included, so working copies are never imported.
 */

interface Item {
  system: { id: string; codename: string; type: string; last_modified: string; name: string };
  elements: Record<string, { value: unknown } | undefined>;
}
interface ItemsPage {
  items: Item[];
  pagination: { next_page?: string };
}

export interface DcpOptions {
  fetch: typeof fetch;
  /** Grades to include. Courses spanning several grades are kept when any of their grades match. */
  grades?: number[];
  onProgress?: (message: string) => void;
  /** Pause between requests, to be gentle with the Ministry's server. */
  delayMs?: number;
  /** Optional cache (used by the build script so re-runs do not hit the server). */
  cache?: { get(url: string): string | null; set(url: string, body: string): void };
  userAgent?: string;
}

const PAGE = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function val<T>(it: Item | undefined, key: string, fallback: T): T {
  const v = it?.elements[key]?.value;
  return (v === undefined || v === null ? fallback : v) as T;
}
const str = (it: Item | undefined, key: string) => {
  const v = val<unknown>(it, key, '');
  return typeof v === 'string' ? v.trim() : '';
};
const refs = (it: Item | undefined, key: string) => val<unknown>(it, key, []) as string[];
const terms = (it: Item | undefined, key: string) => (val<unknown>(it, key, []) as { name: string; codename: string }[]).filter((t) => t && typeof t.name === 'string');

export class DcpClient {
  private requests = 0;
  constructor(private readonly o: DcpOptions) {}

  get requestCount(): number {
    return this.requests;
  }

  private async getJson<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const q = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%5B/g, '[').replace(/%5D/g, ']').replace(/%2C/g, ',')}`)
      .join('&');
    const url = `${DCP_API}${path}${q ? `?${q}` : ''}`;
    const cached = this.o.cache?.get(url);
    if (cached) return JSON.parse(cached) as T;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await this.o.fetch(url, { headers: { Accept: 'application/json', ...(this.o.userAgent ? { 'User-Agent': this.o.userAgent } : {}) } });
        this.requests++;
        if (res.status === 429 || res.status >= 500) throw new Error(`The Ministry's server answered ${res.status}.`);
        if (!res.ok) throw new Error(`The Ministry's server answered ${res.status} for ${path}.`);
        const body = await res.text();
        const parsed = JSON.parse(body) as T;
        this.o.cache?.set(url, body);
        if (this.o.delayMs) await sleep(this.o.delayMs);
        return parsed;
      } catch (err) {
        lastErr = err;
        await sleep(500 * 2 ** attempt);
      }
    }
    throw new Error(`Could not read the Ontario curriculum site: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
  }

  async items(type: string, elements: string[]): Promise<Item[]> {
    const out: Item[] = [];
    for (let skip = 0; ; skip += PAGE) {
      const page = await this.getJson<ItemsPage>('items', {
        'system.type': type,
        language: 'en-CA',
        'system.language[eq]': 'en-CA',
        depth: 0,
        skip,
        limit: PAGE,
        elements: elements.join(','),
      });
      out.push(...page.items);
      if (!page.pagination.next_page || page.items.length < PAGE) break;
    }
    return out;
  }

  async item(codename: string): Promise<Item> {
    const r = await this.getJson<{ item: Item }>(`items/${encodeURIComponent(codename)}`, { language: 'en-CA', depth: 0 });
    return r.item;
  }
}

function supportKind(raw: string): string {
  const first = raw.split('|')[0]!.trim();
  return first || raw.trim() || 'Teacher support';
}

const slugId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Picks the source PDF most likely to contain a PDF-only course, by the grades in its title. */
function pdfForCourse(docs: SourceLink[], grades: number[]): SourceLink | null {
  const scored = docs
    .map((d) => {
      const m = /Grades?\s+(\d+)(?:\s*(?:–|-|and|to)\s*(\d+))?/i.exec(d.title);
      if (!m) return { d, score: 0 };
      const lo = Number(m[1]);
      const hi = m[2] ? Number(m[2]) : lo;
      return { d, score: grades.every((g) => g >= lo && g <= hi) ? 2 : grades.some((g) => g >= lo && g <= hi) ? 1 : -1 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.d ?? null;
}

export async function fetchDcpBundle(o: DcpOptions, now = new Date()): Promise<CurriculumBundle> {
  const grades = o.grades ?? [6, 7, 8, 9, 10, 11, 12];
  const client = new DcpClient(o);
  const say = (m: string) => o.onProgress?.(m);
  const report = { duplicatesRemoved: [] as string[], warnings: [] as string[], skipped: [] as string[] };

  say('Reading the list of live curriculum documents…');
  const home = await client.item('curriculum_home');
  const liveViews = new Set([...refs(home, 'subitems'), ...refs(home, 'subitems_right')]);
  const views = (await client.items('ui___curriculum_view', ['title', 'l1___curriculum', 'url_slug', 'site___curriculum_select__elem__sec____curriculum'])).filter((v) =>
    liveViews.has(v.system.codename),
  );
  say(`${views.length} live curriculum documents.`);

  const l1 = new Map((await client.items('l1___curriculum', ['title', 'monarchs_printer_year', 'curriculum_pdfs', 'revision_history', 'specific_courses'])).map((i) => [i.system.codename, i]));
  const resources = new Map((await client.items('resources', ['title', 'resource_upload', 'site___resources___type'])).map((i) => [i.system.codename, i]));
  const revisions = new Map((await client.items('revision_history', ['title', 'version_date', 'description'])).map((i) => [i.system.codename, i]));
  const destinations = new Map(
    (await client.items('translate___destinations', ['label', 'site___destinations'])).flatMap((i) => terms(i, 'site___destinations').map((t) => [t.codename, str(i, 'label')] as const)),
  );

  const pdfLink = (codename: string): SourceLink | null => {
    const r = resources.get(codename);
    if (!r) return null;
    const asset = (val<{ url?: string; name?: string }[]>(r, 'resource_upload', []) ?? [])[0];
    const url = asset?.url?.replace(':443/', '/');
    if (!url || !url.startsWith('https://') || !/\.pdf$/i.test(url.split('?')[0]!)) return null;
    return { title: str(r, 'title') || asset?.name || 'Curriculum PDF', url };
  };

  const documents: CurriculumDocument[] = [];
  const docByView = new Map<string, { doc: CurriculumDocument; slug: string }>();
  for (const v of views) {
    const l1Code = refs(v, 'l1___curriculum')[0];
    const cur = l1Code ? l1.get(l1Code) : undefined;
    if (!cur) {
      report.skipped.push(`Curriculum page "${str(v, 'title')}" has no curriculum document`);
      continue;
    }
    const levelTerm = terms(v, 'site___curriculum_select__elem__sec____curriculum').map((t) => t.codename);
    const level = levelTerm.includes('secondary') ? 'secondary' : 'elementary';
    const slug = str(v, 'url_slug');
    const doc: CurriculumDocument = {
      id: l1Code!.toLowerCase().replace(/[^a-z0-9_-]+/g, '_'),
      title: str(v, 'title'),
      subject: str(v, 'title'),
      level,
      year: str(cur, 'monarchs_printer_year') || null,
      url: `${DCP_SITE}curriculum/${slug}`,
      sourceDocuments: refs(cur, 'curriculum_pdfs')
        .map(pdfLink)
        .filter((x): x is SourceLink => !!x),
      revisions: refs(cur, 'revision_history')
        .map((c) => revisions.get(c))
        .filter((r): r is Item => !!r)
        .map((r) => ({ date: str(r, 'version_date').slice(0, 10), title: str(r, 'title'), description: sanitizeRichText(str(r, 'description')).text }))
        .filter((r) => r.date || r.description)
        .sort((a, b) => b.date.localeCompare(a.date)),
      sourceId: cur.system.id,
      sourceModified: cur.system.last_modified,
    };
    documents.push(doc);
    docByView.set(v.system.codename, { doc, slug });
  }

  say('Reading courses…');
  const courseItems = await client.items('l2___course', [
    'code',
    'name',
    'year_issued',
    'site___grade',
    'course_slug',
    'prerequisites',
    'part_of',
    'sections',
    'site___destinations',
    'site___curriculum_disciplines',
    'course_pdfs',
    'description',
  ]);
  say('Reading strands and expectations…');
  const collections = new Map((await client.items('ui___content_collection', ['sections'])).map((i) => [i.system.codename, i]));
  const strandItems = new Map((await client.items('l3___strand', ['title', 'title_index', 'overall_expectations', 'url_slug'])).map((i) => [i.system.codename, i]));
  const overallItems = new Map((await client.items('l4___overall_expectation', ['title', 'title_index', 'content', 'specific_expectations', 'url_slug'])).map((i) => [i.system.codename, i]));
  const specificItems = new Map((await client.items('l5___specific_expectation', ['title', 'title_index', 'content', 'elaborations'])).map((i) => [i.system.codename, i]));
  say('Reading teacher supports…');
  const elaborations = new Map((await client.items('elaborations', ['pedagogical_supports', 'elaboration'])).map((i) => [i.system.codename, i]));

  const strandsOf = (course: Item) => {
    const out: string[] = [];
    for (const sc of refs(course, 'sections')) {
      if (strandItems.has(sc)) out.push(sc);
      else {
        const col = collections.get(sc);
        if (col) out.push(...refs(col, 'sections').filter((x) => strandItems.has(x)));
      }
    }
    return [...new Set(out)];
  };

  const courses: CurriculumCourse[] = [];
  const strands: CurriculumStrand[] = [];
  const expectations: CurriculumExpectation[] = [];
  const seenCourse = new Map<string, { course: CurriculumCourse; digital: boolean }>();
  const candidates: { item: Item; doc: CurriculumDocument; slug: string; grades: number[]; strandCodes: string[] }[] = [];

  for (const c of courseItems) {
    const view = refs(c, 'part_of')[0];
    const d = view ? docByView.get(view) : undefined;
    if (!d) continue;
    const g = terms(c, 'site___grade')
      .map((t) => Number(t.name))
      .filter((n) => Number.isInteger(n));
    if (!g.some((x) => grades.includes(x))) continue;
    candidates.push({ item: c, doc: d.doc, slug: d.slug, grades: [...new Set(g)].sort((a, b) => a - b), strandCodes: strandsOf(c) });
  }
  // Digital versions first, so a PDF-only duplicate of the same course is the one dropped.
  candidates.sort((a, b) => Number(b.strandCodes.length > 0) - Number(a.strandCodes.length > 0));

  for (const cand of candidates) {
    const c = cand.item;
    const code = str(c, 'code').replace(/\s+/g, '') || null;
    const name = str(c, 'name') || cand.doc.title;
    const id = code ? `on-${slugId(code)}` : `on-${slugId(cand.slug)}-${slugId(str(c, 'course_slug') || name)}`;
    const key = code ? `${cand.doc.id}|${code.toUpperCase()}` : `${cand.doc.id}|${name}|${cand.grades.join(',')}`;
    if (seenCourse.has(key) || courses.some((x) => x.id === id)) {
      report.duplicatesRemoved.push(`${code ?? name} (Grade ${cand.grades.join('/')}) in ${cand.doc.title}: a second copy${cand.strandCodes.length ? '' : ' (PDF-only)'} was ignored`);
      continue;
    }
    const url = `${DCP_SITE}curriculum/${cand.slug}/${cand.doc.level === 'elementary' ? 'grades' : 'courses'}/${str(c, 'course_slug')}`;
    const destination = terms(c, 'site___destinations')
      .map((t) => destinations.get(t.codename) || t.name)
      .join(' / ');
    const coursePdf = refs(c, 'course_pdfs').map(pdfLink).find((x) => !!x) ?? null;
    const course: CurriculumCourse = {
      id,
      documentId: cand.doc.id,
      code,
      name,
      subject: terms(c, 'site___curriculum_disciplines')[0]?.name || cand.doc.subject,
      grades: cand.grades,
      courseType: destination || null,
      prerequisites: listItems(str(c, 'prerequisites')),
      description: sanitizeRichText(str(c, 'description')).text,
      yearIssued: str(c, 'year_issued') || null,
      url,
      expectationsSource: 'pdf',
      pdf: coursePdf,
      sourceId: c.system.id,
      sourceModified: c.system.last_modified,
    };

    const before = expectations.length;
    const usedIds = new Set<string>();
    const uniqueId = (base: string) => {
      let idv = base;
      for (let n = 2; usedIds.has(idv); n++) idv = `${base}~${n}`;
      if (idv !== base) report.warnings.push(`${course.code ?? course.name}: the number ${base.split(':')[1]} is used twice; the second is stored as ${idv.split(':')[1]}`);
      usedIds.add(idv);
      return idv;
    };
    let sort = 0;
    cand.strandCodes.forEach((sc, si) => {
      const s = strandItems.get(sc)!;
      const strandIndex = str(s, 'title_index') || String.fromCharCode(65 + si);
      const strand: CurriculumStrand = {
        id: uniqueId(`${id}:${strandIndex}`),
        courseId: id,
        index: strandIndex,
        title: sanitizeRichText(str(s, 'title')).text || strandIndex,
        sort: si,
        sourceId: s.system.id,
      };
      let added = 0;
      for (const oc of refs(s, 'overall_expectations')) {
        const o = overallItems.get(oc);
        if (!o) continue; // pedagogical notes and tables are linked here too
        const ot = sanitizeRichText(str(o, 'content'));
        if (!ot.text) {
          report.warnings.push(`${course.code ?? course.name} ${str(o, 'title_index')}: overall expectation has no text and was skipped`);
          continue;
        }
        const oIndex = str(o, 'title_index') || `${strandIndex}${added + 1}`;
        const oUrl = str(s, 'url_slug') && str(o, 'url_slug') ? `${url}/${str(s, 'url_slug')}/${str(o, 'url_slug')}` : url;
        const overall: CurriculumExpectation = {
          id: uniqueId(`${id}:${oIndex}`),
          courseId: id,
          strandId: strand.id,
          kind: 'overall',
          parentId: null,
          index: oIndex,
          title: sanitizeRichText(str(o, 'title')).text,
          html: ot.html,
          text: ot.text,
          url: oUrl,
          sort: sort++,
          supports: [],
          sourceId: o.system.id,
          sourceModified: o.system.last_modified,
        };
        expectations.push(overall);
        added++;
        for (const spc of refs(o, 'specific_expectations')) {
          const sp = specificItems.get(spc);
          if (!sp) continue;
          const st = sanitizeRichText(str(sp, 'content'));
          if (!st.text) {
            report.warnings.push(`${course.code ?? course.name} ${str(sp, 'title_index')}: specific expectation has no text and was skipped`);
            continue;
          }
          const supports: Support[] = refs(sp, 'elaborations')
            .map((ec) => elaborations.get(ec))
            .filter((e): e is Item => !!e)
            .map((e) => {
              const r = sanitizeRichText(str(e, 'elaboration'));
              return { kind: supportKind(terms(e, 'pedagogical_supports')[0]?.name ?? ''), html: r.html, text: r.text, omittedMedia: r.omittedMedia };
            })
            .filter((x) => x.text || x.omittedMedia);
          expectations.push({
            id: uniqueId(`${id}:${str(sp, 'title_index') || `${oIndex}.${expectations.length}`}`),
            courseId: id,
            strandId: strand.id,
            kind: 'specific',
            parentId: overall.id,
            index: str(sp, 'title_index') || `${oIndex}.?`,
            title: sanitizeRichText(str(sp, 'title')).text,
            html: st.html,
            text: st.text,
            url: oUrl,
            sort: sort++,
            supports,
            sourceId: sp.system.id,
            sourceModified: sp.system.last_modified,
          });
        }
      }
      if (added) strands.push(strand);
    });
    if (expectations.length > before) course.expectationsSource = 'digital';
    else {
      course.expectationsSource = 'pdf';
      course.pdf ??= pdfForCourse(cand.doc.sourceDocuments, cand.grades);
    }
    courses.push(course);
    seenCourse.set(key, { course, digital: course.expectationsSource === 'digital' });
  }

  courses.sort((a, b) => a.grades[0]! - b.grades[0]! || (a.code ?? a.name).localeCompare(b.code ?? b.name));
  documents.sort((a, b) => a.level.localeCompare(b.level) || a.title.localeCompare(b.title));
  say(`Done: ${courses.length} courses, ${expectations.length} expectations, ${client.requestCount} requests.`);
  return {
    format: CURRICULUM_FORMAT,
    version: 1,
    jurisdiction: 'Ontario, Canada',
    source: {
      name: 'Ontario Ministry of Education — Curriculum and Resources',
      site: DCP_SITE,
      api: DCP_API,
      copyright: "© King's Printer for Ontario. Reproduced for non-commercial educational use without changes; this is not an official copy.",
      terms: CROWN_COPYRIGHT_TERMS,
      official: true,
    },
    fetchedAt: now.toISOString(),
    grades,
    documents,
    courses,
    strands,
    expectations,
    report,
  };
}

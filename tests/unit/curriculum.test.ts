import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundleHash, diffBundles, parseBundle, readBundleFile } from '../../src/core/curriculum/bundle';
import { fetchDcpBundle } from '../../src/core/curriculum/dcp';
import { listItems, sanitizeRichText } from '../../src/core/curriculum/richtext';
import { CurriculumService } from '../../src/core/curriculum/service';
import { Db } from '../../src/core/db/database';
import { DCP_SITE, validateBundle, type CurriculumBundle } from '../../src/shared/curriculum/types';
import { FakeClock } from '../helpers/db';

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'curriculum-sample.json.gz');
const SHIPPED = path.join(__dirname, '..', '..', 'resources', 'curriculum', 'ontario.json.gz');
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function store(bundle: CurriculumBundle | null = readBundleFile(FIXTURE)) {
  const clock = new FakeClock('2026-10-22T12:00:00Z');
  const db = new Db(':memory:');
  const svc = new CurriculumService({ db, clock, loadBundled: bundle ? () => bundle : null });
  return { db, clock, svc };
}

describe('Ministry rich text', () => {
  it('keeps the wording, turns glossary links into plain terms and superscripts into characters', () => {
    const r = sanitizeRichText(
      '<p>describe the differences between <a data-item-id="c00b" href="">volume</a> and <a href="">capacity</a>, and relate millilitres to cubic centimetres (cm<sup>3</sup>)</p>',
    );
    expect(r.text).toBe('describe the differences between volume and capacity, and relate millilitres to cubic centimetres (cm³)');
    expect(r.html).toBe('<p>describe the differences between <span class="term">volume</span> and <span class="term">capacity</span>, and relate millilitres to cubic centimetres (cm<sup>3</sup>)</p>');
    expect(r.omittedMedia).toBe(false);
  });

  it('keeps spaces between inline elements and subscripts in formulas', () => {
    expect(sanitizeRichText('<p><em>a</em> <strong>b</strong></p>').text).toBe('a b');
    expect(sanitizeRichText('<p>H<sub>2</sub>O and CO<sub>2</sub></p>').text).toBe('H₂O and CO₂');
  });

  it('drops scripts, images and embedded items, and flags that something was left out', () => {
    const r = sanitizeRichText('<p>Look:</p><figure><img src="x.png" alt="a chart"><figcaption>Chart</figcaption></figure><script>alert(1)</script><object data-codename="x"></object><p onclick="x()">done</p>');
    expect(r.html).toBe('<p>Look:</p><p>done</p>');
    expect(r.text).toBe('Look:\ndone');
    expect(r.omittedMedia).toBe(true);
    expect(r.html).not.toMatch(/script|img|onclick|object/);
  });

  it('escapes text so it can never become markup', () => {
    const r = sanitizeRichText('<p>if a &lt; b &amp;&amp; c &gt; d then &lt;script&gt;</p>');
    expect(r.text).toBe('if a < b && c > d then <script>');
    expect(r.html).toBe('<p>if a &lt; b &amp;&amp; c &gt; d then &lt;script&gt;</p>');
  });

  it('formats nested lists as indented lines and reads prerequisite lists', () => {
    const r = sanitizeRichText('<ul>\n  <li><strong>examples:</strong>\n    <ul>\n      <li>100% = 1</li>\n      <li>10% = 0.1</li>\n    </ul>\n  </li>\n</ul>');
    expect(r.text).toBe('- examples:\n  - 100% = 1\n  - 10% = 0.1');
    expect(listItems('<ul>\n  <li>Science, Grade 10, Academic</li>\n</ul>')).toEqual(['Science, Grade 10, Academic']);
    expect(listItems('<p><br></p>')).toEqual([]);
  });
});

describe('shipped Ontario curriculum bundle', () => {
  const b = readBundleFile(SHIPPED);

  it('passes schema and structural validation and only links to the Ministry site', () => {
    expect(validateBundle(b)).toEqual([]);
    expect(b.source.official).toBe(true);
    expect(b.source.site).toBe(DCP_SITE);
    for (const c of b.courses) expect(c.url.startsWith(DCP_SITE)).toBe(true);
  });

  it('covers Grades 6 to 12 with course codes, course types and prerequisites preserved', () => {
    const grades = new Set(b.courses.flatMap((c) => c.grades));
    for (const g of [6, 7, 8, 9, 10, 11, 12]) expect(grades.has(g)).toBe(true);
    const mth1w = b.courses.find((c) => c.code === 'MTH1W')!;
    expect(mth1w).toMatchObject({ name: 'Mathematics', grades: [9], courseType: 'De-streamed', expectationsSource: 'digital' });
    const sbi3u = b.courses.find((c) => c.code === 'SBI3U')!;
    expect(sbi3u.courseType).toBe('University Preparation');
    expect(sbi3u.prerequisites).toEqual(['Science, Grade 10, Academic']);
    // The Ministry publishes Grade 11 functions only as a PDF; the app says so instead of inventing expectations.
    const mcr3u = b.courses.find((c) => c.code === 'MCR3U')!;
    expect(mcr3u.expectationsSource).toBe('pdf');
    expect(b.expectations.some((e) => e.courseId === mcr3u.id)).toBe(false);
    expect(mcr3u.pdf?.url).toMatch(/^https:\/\//);
  });

  it('stores official expectations with their Ministry numbers and source links', () => {
    const e = b.expectations.find((x) => x.id === 'on-mth1w:B2.1')!;
    expect(e.kind).toBe('specific');
    expect(e.parentId).toBe('on-mth1w:B2');
    expect(e.text.startsWith('analyse, through the use of patterning, the relationship between the sign and size of an exponent')).toBe(true);
    expect(e.url).toBe(`${DCP_SITE}curriculum/secondary-mathematics/courses/mth1w/b/b2`);
    const counts = { overall: b.expectations.filter((x) => x.kind === 'overall').length, specific: b.expectations.filter((x) => x.kind === 'specific').length };
    expect(counts.overall).toBeGreaterThan(2000);
    expect(counts.specific).toBeGreaterThan(8000);
  });
});

describe('importing from the Ministry API', () => {
  /** A tiny fake of the content API with one live and one working-copy document. */
  function fakeApi(): typeof fetch {
    const t = (type: string, codename: string, elements: Record<string, unknown>, modified = '2025-01-01T00:00:00Z') => ({
      system: { id: `id-${codename}`, codename, type, name: codename, last_modified: modified },
      elements: Object.fromEntries(Object.entries(elements).map(([k, v]) => [k, { value: v }])),
    });
    const types: Record<string, unknown[]> = {
      ui___curriculum_view: [
        t('ui___curriculum_view', 'view_math', { title: 'Mathematics', l1___curriculum: ['l1_math'], url_slug: 'secondary-mathematics', site___curriculum_select__elem__sec____curriculum: [{ name: 'Secondary', codename: 'secondary' }] }),
        t('ui___curriculum_view', 'view_draft', { title: 'Draft', l1___curriculum: ['l1_draft'], url_slug: 'draft', site___curriculum_select__elem__sec____curriculum: [{ name: 'Secondary', codename: 'secondary' }] }),
      ],
      l1___curriculum: [t('l1___curriculum', 'l1_math', { monarchs_printer_year: '2021', curriculum_pdfs: ['pdf_math'], revision_history: [] }), t('l1___curriculum', 'l1_draft', {})],
      resources: [t('resources', 'pdf_math', { title: 'The Ontario Curriculum, Grades 11 and 12: Mathematics', resource_upload: [{ url: 'https://assets.example/math1112.pdf', name: 'm.pdf' }] })],
      revision_history: [],
      translate___destinations: [t('translate___destinations', 'd1', { label: 'De-streamed', site___destinations: [{ name: 'Destreamed', codename: 'destreamed' }] })],
      l2___course: [
        t('l2___course', 'c_mth1w', { code: 'MTH1W', name: 'Mathematics', site___grade: [{ name: '9', codename: 'n9' }], course_slug: 'mth1w', part_of: ['view_math'], sections: ['col1'], site___destinations: [{ name: 'Destreamed', codename: 'destreamed' }], prerequisites: '<p><br></p>', description: '<p>A course.</p>' }),
        t('l2___course', 'c_mth1w_pdf', { code: 'MTH1W', name: 'Mathematics', site___grade: [{ name: '9', codename: 'n9' }], course_slug: 'mth1w-pdf', part_of: ['view_math'], sections: [] }),
        t('l2___course', 'c_mcr3u', { code: 'MCR3U', name: 'Functions', site___grade: [{ name: '11', codename: 'n11' }], course_slug: 'mcr3u-pdf', part_of: ['view_math'], sections: [], prerequisites: '<ul><li>Principles of Mathematics, Grade 10, Academic</li></ul>' }),
        t('l2___course', 'c_draft', { code: 'XXX1O', name: 'Draft', site___grade: [{ name: '9', codename: 'n9' }], course_slug: 'x', part_of: ['view_draft'], sections: [] }),
        t('l2___course', 'c_g3', { code: 'ZZZ', name: 'Too young', site___grade: [{ name: '3', codename: 'n3' }], course_slug: 'z', part_of: ['view_math'], sections: [] }),
      ],
      ui___content_collection: [t('ui___content_collection', 'col1', { sections: ['strand_b'] })],
      l3___strand: [t('l3___strand', 'strand_b', { title: 'Number', title_index: 'B', overall_expectations: ['oe_b1', 'ped_note'], url_slug: 'b' })],
      l4___overall_expectation: [t('l4___overall_expectation', 'oe_b1', { title: '', title_index: 'B1', content: '<p>demonstrate an understanding of numbers</p>', specific_expectations: ['se_b11', 'ped_support'], url_slug: 'b1' })],
      l5___specific_expectation: [t('l5___specific_expectation', 'se_b11', { title_index: 'B1.1', title: 'Powers', content: '<p>evaluate <a href="">powers</a></p>', elaborations: ['el1'] })],
      elaborations: [t('elaborations', 'el1', { pedagogical_supports: [{ name: 'Key Concepts | Concepts clés', codename: 'k' }], elaboration: '<ul><li>A power has a base.</li></ul>' })],
    };
    return (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const body = url.pathname.endsWith('/items/curriculum_home')
        ? { item: t('ui___view', 'curriculum_home', { subitems: [], subitems_right: ['view_math'] }) }
        : { items: types[url.searchParams.get('system.type') ?? ''] ?? [], pagination: { next_page: '' } };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  }

  it('imports only live documents, keeps the digital copy of a duplicated course and flags PDF-only courses', async () => {
    const b = await fetchDcpBundle({ fetch: fakeApi() }, new Date('2026-10-22T00:00:00Z'));
    expect(validateBundle(b)).toEqual([]);
    expect(b.courses.map((c) => c.code).sort()).toEqual(['MCR3U', 'MTH1W']);
    expect(b.report.duplicatesRemoved).toHaveLength(1);
    const mth1w = b.courses.find((c) => c.code === 'MTH1W')!;
    expect(mth1w).toMatchObject({ id: 'on-mth1w', courseType: 'De-streamed', expectationsSource: 'digital', url: `${DCP_SITE}curriculum/secondary-mathematics/courses/mth1w` });
    const mcr3u = b.courses.find((c) => c.code === 'MCR3U')!;
    expect(mcr3u.expectationsSource).toBe('pdf');
    expect(mcr3u.prerequisites).toEqual(['Principles of Mathematics, Grade 10, Academic']);
    expect(mcr3u.pdf).toEqual({ title: 'The Ontario Curriculum, Grades 11 and 12: Mathematics', url: 'https://assets.example/math1112.pdf' });
    expect(b.expectations.map((e) => e.id)).toEqual(['on-mth1w:B1', 'on-mth1w:B1.1']);
    const se = b.expectations[1]!;
    expect(se).toMatchObject({ text: 'evaluate powers', parentId: 'on-mth1w:B1', url: `${DCP_SITE}curriculum/secondary-mathematics/courses/mth1w/b/b1` });
    expect(se.supports).toEqual([{ kind: 'Key Concepts', html: '<ul><li>A power has a base.</li></ul>', text: '- A power has a base.', omittedMedia: false }]);
  });
});

describe('curriculum store', () => {
  it('imports the bundled snapshot once and answers navigation queries offline', () => {
    const { svc } = store();
    const first = svc.ensureBundled();
    expect(first?.summary).toBe('First import');
    expect(svc.ensureBundled()).toBeNull();
    const o = svc.overview();
    expect(o.grades).toEqual([6, 7, 8, 9, 10, 11]);
    expect(o.pdfOnlyCourses).toBe(1);
    const g7 = svc.courses({ grade: 7 });
    expect(g7.map((c) => c.documentTitle).sort()).toEqual(['Mathematics', 'Science and Technology', 'Social Studies, History, and Geography']);
    const math = svc.course('on-mth1w');
    expect(math.course.label).toBe('Mathematics, Grade 9, De-streamed (MTH1W)');
    expect(math.strands.map((s) => s.index)).toEqual(['AA', 'A', 'B', 'C', 'D', 'E', 'F']);
    const b2 = math.strands.find((s) => s.index === 'B')!.overall.find((o) => o.index === 'B2')!;
    expect(b2.specifics.map((s) => s.index)).toEqual(['B2.1', 'B2.2']);
    const e = svc.expectation('on-mth1w:B2.1');
    expect(e.verification).toBe('verified');
    expect(e.course.code).toBe('MTH1W');
    expect(e.parent?.id).toBe('on-mth1w:B2');
    expect(e.url.startsWith(DCP_SITE)).toBe(true);
    expect(e.supports.length).toBeGreaterThan(0);
    expect(svc.course('on-mcr3u').course.verification).toBe('pdf_only');
  });

  it('searches expectations and courses', () => {
    const { svc } = store();
    svc.ensureBundled();
    const hits = svc.search('square roots', { grade: 8 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.grades.includes(8))).toBe(true);
    expect(svc.search('MTH1W')[0]).toMatchObject({ type: 'course', id: 'on-mth1w' });
    expect(svc.search('"); DROP TABLE x; --')).toEqual([]);
  });

  it('tracks revisions when the Ministry rewords, adds or removes expectations', () => {
    const base = readBundleFile(FIXTURE);
    const { svc, clock } = store(base);
    svc.ensureBundled();
    const next = clone(base);
    next.fetchedAt = '2026-11-01T00:00:00.000Z';
    const target = next.expectations.find((e) => e.id === 'on-mth1w:B2.1')!;
    target.text += ' (revised)';
    target.html = `<p>${target.text}</p>`;
    const removed = next.expectations.findIndex((e) => e.id === 'on-mth1w:B3.5');
    next.expectations.splice(removed, 1);
    clock.advance(86_400_000);
    const imp = svc.importBundle(next, 'live');
    expect(imp.summary).toBe('1 expectation reworded, 1 expectation removed');
    const e = svc.expectation('on-mth1w:B2.1');
    expect(e.text.endsWith('(revised)')).toBe(true);
    expect(e.revisions[0]).toMatchObject({ change: 'changed', after: target.text });
    expect(e.revisions[0]!.before).not.toContain('(revised)');
    const gone = svc.expectation('on-mth1w:B3.5');
    expect(gone.verification).toBe('removed_upstream');
    expect(svc.course('on-mth1w').strands.find((s) => s.index === 'B')!.overall.find((o) => o.index === 'B3')!.specifics.map((s) => s.index)).not.toContain('B3.5');
    expect(svc.imports().map((i) => i.source)).toEqual(['live', 'bundled']);
  });

  it('marks imported files as unverified and never lets them replace official text', () => {
    const base = readBundleFile(FIXTURE);
    const { svc } = store(base);
    svc.ensureBundled();
    const file = clone(base);
    file.courses = file.courses.filter((c) => c.code === 'MTH1W');
    file.expectations = file.expectations.filter((e) => e.courseId === 'on-mth1w').map((e) => ({ ...e, text: 'tampered' }));
    file.strands = file.strands.filter((s) => s.courseId === 'on-mth1w');
    file.documents = file.documents.filter((d) => d.id === file.courses[0]!.documentId);
    // A new course someone typed in from a PDF.
    file.courses.push({ ...file.courses[0]!, id: 'on-mcr3u-local', code: 'MCR3U-LOCAL', name: 'Functions (typed from the PDF)', grades: [11], expectationsSource: 'digital', url: `${DCP_SITE}curriculum/secondary-mathematics/courses/mcr3u-pdf` });
    file.strands.push({ id: 'on-mcr3u-local:A', courseId: 'on-mcr3u-local', index: 'A', title: 'Characteristics of Functions', sort: 0, sourceId: 'x' });
    file.expectations.push({ ...file.expectations[0]!, id: 'on-mcr3u-local:A1', courseId: 'on-mcr3u-local', strandId: 'on-mcr3u-local:A', kind: 'overall', parentId: null, index: 'A1', text: 'demonstrate an understanding of functions' });
    const imp = svc.importFile(file);
    expect(imp.official).toBe(false);
    expect(svc.expectation('on-mth1w:B2.1').text).not.toBe('tampered');
    expect(svc.expectation('on-mth1w:B2.1').verification).toBe('verified');
    expect(svc.expectation('on-mcr3u-local:A1').verification).toBe('unverified');
    expect(svc.course('on-mcr3u-local').course.verification).toBe('unverified');
    expect(svc.overview().unverified).toBeGreaterThan(0);
  });

  it('rejects malformed files with a list of problems', () => {
    const { svc } = store();
    svc.ensureBundled();
    const bad = clone(readBundleFile(FIXTURE));
    bad.expectations[5]!.parentId = 'missing';
    expect(() => svc.importFile(bad)).toThrow(/problem/);
    expect(() => parseBundle({ format: 'nope' })).toThrow(/not a valid curriculum file/);
  });

  it('reports coverage from real numbers and does not claim full coverage', () => {
    const { svc } = store();
    svc.ensureBundled();
    const one = svc.expectationsOf('on-mth1w')[0]!.id;
    const r = svc.coverage({ lessons: () => new Set([one]), practice: () => new Set([one]), assessments: () => new Set(), aiOnly: () => new Set() });
    expect(r.totals.withLessons).toBe(1);
    expect(r.rows.find((x) => x.courseId === 'on-mth1w')!.withLessons).toBe(1);
    expect(r.statement).toContain('No course is fully covered yet.');
    expect(r.statement).toContain('only published as PDFs');
  });

  it('diffs identical bundles as unchanged', () => {
    const b = readBundleFile(FIXTURE);
    const d = diffBundles(b, clone(b));
    expect(d.changed.length + d.added.length + d.removed.length + d.addedCourses.length).toBe(0);
    expect(bundleHash(b)).toBe(bundleHash(clone(b)));
  });
});

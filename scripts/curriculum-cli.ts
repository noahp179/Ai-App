// Fetches the Ontario curriculum from the Ministry of Education's Curriculum and Resources site and writes the
// bundle that ships with FlowCompanion. Run through scripts/curriculum.mjs:
//   node scripts/curriculum.mjs fetch    refresh resources/curriculum/ontario.json.gz (uses .cache/dcp)
//   node scripts/curriculum.mjs verify   compare the shipped bundle with the live site (no cache); exit 1 on drift
//   node scripts/curriculum.mjs summary  print counts per document and course
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { bundleHash, diffBundles, diffSummary, readBundleFile, writeBundleFile } from '../src/core/curriculum/bundle';
import { fetchDcpBundle } from '../src/core/curriculum/dcp';
import { SKILL_PACKS } from '../src/core/study/content/registry';
import { CurriculumBundleSchema, courseLabel, validateBundle, type CurriculumBundle } from '../src/shared/curriculum/types';

const root = process.cwd();
const out = path.join(root, 'resources', 'curriculum', 'ontario.json.gz');
const cacheDir = path.join(root, '.cache', 'dcp');
const [cmd = 'summary'] = process.argv.slice(2);

const fileCache = {
  get(url: string) {
    const f = path.join(cacheDir, `${crypto.createHash('sha1').update(url).digest('hex')}.json`);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  },
  set(url: string, body: string) {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, `${crypto.createHash('sha1').update(url).digest('hex')}.json`), body);
  },
};

function check(b: CurriculumBundle): void {
  CurriculumBundleSchema.parse(b);
  const problems = validateBundle(b);
  if (problems.length) {
    console.error(`The fetched curriculum failed validation (${problems.length} problems):`);
    for (const p of problems.slice(0, 40)) console.error(`  - ${p}`);
    process.exit(2);
  }
}

function summary(b: CurriculumBundle): void {
  console.log(`Fetched ${b.fetchedAt} from ${b.source.site}`);
  console.log(`${b.documents.length} curriculum documents, ${b.courses.length} courses (${b.courses.filter((c) => c.expectationsSource === 'digital').length} with expectations), ${b.strands.length} strands,`);
  console.log(`${b.expectations.filter((e) => e.kind === 'overall').length} overall and ${b.expectations.filter((e) => e.kind === 'specific').length} specific expectations. Hash ${bundleHash(b)}`);
  for (const d of b.documents) {
    const cs = b.courses.filter((c) => c.documentId === d.id);
    console.log(`\n${d.title} (${d.level}${d.year ? `, ${d.year}` : ''}) — ${cs.length} courses`);
    for (const c of cs) {
      const n = b.expectations.filter((e) => e.courseId === c.id && e.kind === 'specific').length;
      console.log(`  ${courseLabel(c)}: ${c.expectationsSource === 'digital' ? `${n} specific expectations` : 'PDF only'}`);
    }
  }
  if (b.report.duplicatesRemoved.length) console.log(`\nDuplicates removed:\n  ${b.report.duplicatesRemoved.join('\n  ')}`);
  if (b.report.warnings.length) console.log(`\nWarnings:\n  ${b.report.warnings.join('\n  ')}`);
}

const userAgent = 'FlowCompanion curriculum importer (+https://github.com/noahp179/Ai-App)';

if (cmd === 'fetch') {
  const previous = fs.existsSync(out) ? readBundleFile(out) : null;
  const b = await fetchDcpBundle({ fetch, cache: process.argv.includes('--no-cache') ? undefined : fileCache, delayMs: 250, onProgress: (m) => console.log(m), userAgent });
  check(b);
  const diff = diffBundles(previous, b);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeBundleFile(out, b);
  console.log(`Wrote ${path.relative(root, out)} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB). Changes since the previous bundle: ${previous ? diffSummary(diff) : 'first import'}.`);
} else if (cmd === 'verify') {
  const shipped = readBundleFile(out);
  const live = await fetchDcpBundle({ fetch, delayMs: 250, onProgress: (m) => console.log(m), userAgent });
  check(live);
  const diff = diffBundles(shipped, live);
  console.log(`Shipped bundle fetched ${shipped.fetchedAt}. Live site compared ${live.fetchedAt}: ${diffSummary(diff)}.`);
  for (const c of diff.changed.slice(0, 20)) console.log(`  reworded ${c.id}\n    before: ${c.before.slice(0, 200)}\n    after:  ${c.after.slice(0, 200)}`);
  const drift = diff.added.length + diff.removed.length + diff.changed.length + diff.addedCourses.length + diff.removedCourses.length + diff.changedCourses.length;
  process.exit(drift ? 1 : 0);
} else if (cmd === 'summary') {
  summary(readBundleFile(out));
} else if (cmd === 'fixture') {
  // Representative records, copied verbatim from the shipped bundle, for unit tests.
  const b = readBundleFile(out);
  const want = (c: CurriculumBundle['courses'][number]) =>
    ['MTH1W', 'SNC1W', 'ENL1W', 'CHC2D', 'MCR3U', 'FSF1D', 'BEM1O'].includes(c.code ?? '') ||
    (!c.code && c.grades.length === 1 && [6, 7, 8].includes(c.grades[0]!) && /mathematics/.test(c.id)) ||
    (!c.code && c.grades[0] === 7 && /science/.test(c.id)) ||
    (!c.code && c.grades[0] === 7 && /history/.test(c.id));
  const courses = b.courses.filter(want);
  const ids = new Set(courses.map((c) => c.id));
  const fixture: CurriculumBundle = {
    ...b,
    documents: b.documents.filter((d) => courses.some((c) => c.documentId === d.id)),
    courses,
    strands: b.strands.filter((s) => ids.has(s.courseId)),
    expectations: b.expectations.filter((e) => ids.has(e.courseId)).map((e) => ({ ...e, supports: e.supports.slice(0, 3) })),
    report: { duplicatesRemoved: [], warnings: [], skipped: [] },
  };
  check(fixture);
  const file = path.join(root, 'tests', 'fixtures', 'curriculum-sample.json.gz');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeBundleFile(file, fixture);
  console.log(`Wrote ${path.relative(root, file)}: ${fixture.courses.length} courses, ${fixture.expectations.length} expectations.`);
} else if (cmd === 'coverage') {
  // docs/CURRICULUM_COVERAGE.md, computed from the shipped bundle and the authored skill packs. Not edited by hand.
  const file = path.join(root, 'docs', 'CURRICULUM_COVERAGE.md');
  fs.writeFileSync(file, coverageMarkdown(readBundleFile(out)));
  console.log(`Wrote ${path.relative(root, file)}.`);
} else {
  console.error(`Unknown command ${cmd}. Use fetch, verify, summary, fixture or coverage.`);
  process.exit(64);
}

function coverageMarkdown(b: CurriculumBundle): string {
  const specific = b.expectations.filter((e) => e.kind === 'specific');
  const byId = new Map(b.expectations.map((e) => [e.id, e]));
  const authored = new Map<string, string[]>();
  for (const p of SKILL_PACKS) for (const e of p.expectations) authored.set(e.id, [...(authored.get(e.id) ?? []), p.id]);
  const unknown = [...authored.keys()].filter((id) => !byId.has(id));
  const digital = b.courses.filter((c) => c.expectationsSource === 'digital');
  const pdf = b.courses.filter((c) => c.expectationsSource === 'pdf');
  const withSupports = specific.filter((e) => e.supports.length).length;
  const pct = (n: number, d: number) => `${d ? ((100 * n) / d).toFixed(1) : '0.0'}%`;
  const L: string[] = [];
  L.push('# Curriculum coverage and verification', '');
  L.push('_Generated by `npm run curriculum:coverage` from the shipped curriculum bundle and the authored skill packs. Do not edit by hand._', '');
  L.push('## Summary', '');
  L.push(
    `FlowCompanion lists **${b.courses.length} Ontario courses and grade-level subjects for Grades 6–12** from ${b.documents.length} current curriculum documents, with **${specific.length} specific expectations** quoted word for word from the Ministry of Education. ` +
      `It has its own offline lessons and code-checked practice for **${authored.size} of them (${pct(authored.size, specific.length)})**, all in mathematics, usually for part of what each expectation asks. ` +
      `Every other expectation can be read in full with a link to its Ministry page; ${withSupports} expectations also include the Ministry's own teacher supports, and the optional AI tutor can explain any expectation (AI material is labelled as such).`,
    '',
  );
  L.push('FlowCompanion does not claim to cover the whole Ontario curriculum, and nothing in it is endorsed by the Ministry of Education.', '');
  L.push('## Source', '');
  L.push(`- Site: ${b.source.site} (data from ${b.source.api})`);
  L.push(`- Fetched: ${b.fetchedAt}`);
  L.push(`- Bundle hash: \`${bundleHash(b)}\``);
  L.push(`- Copyright: ${b.source.copyright} Terms: ${b.source.terms}`);
  L.push('- Text is stored verbatim (only formatting is reduced to a safe subset of HTML); images, tables and media in the original are left out and the expectation links to the Ministry page instead.', '');
  L.push('## Totals', '');
  L.push('| | Count |', '|---|---|');
  L.push(`| Curriculum documents | ${b.documents.length} |`);
  L.push(`| Courses and grade-level subjects | ${b.courses.length} |`);
  L.push(`| … with expectations on the Ministry site (imported) | ${digital.length} |`);
  L.push(`| … published only as PDF (listed with a link; expectations not imported) | ${pdf.length} |`);
  L.push(`| Strands | ${b.strands.length} |`);
  L.push(`| Overall expectations | ${b.expectations.length - specific.length} |`);
  L.push(`| Specific expectations | ${specific.length} |`);
  L.push(`| Specific expectations with Ministry teacher supports | ${withSupports} |`);
  L.push(`| Authored skill packs | ${SKILL_PACKS.length} |`);
  L.push(`| Specific expectations with offline lessons and code-checked practice | ${authored.size} |`, '');
  if (unknown.length) L.push(`**Problem:** ${unknown.length} skill-pack mappings point at expectations that are not in the bundle: ${unknown.join(', ')}`, '');
  L.push('## Offline lessons and practice by course', '');
  L.push('| Course | Specific expectations | With offline lessons | Expectations |', '|---|---|---|---|');
  for (const c of digital) {
    const exps = specific.filter((e) => e.courseId === c.id);
    const covered = exps.filter((e) => authored.has(e.id));
    if (!covered.length) continue;
    L.push(`| ${courseLabel(c)} | ${exps.length} | ${covered.length} (${pct(covered.length, exps.length)}) | ${covered.map((e) => e.index).join(', ')} |`);
  }
  L.push('', 'Every other course has no offline lessons yet: its expectations, Ministry supports (where published) and the optional AI tutor are available.', '');
  L.push('## Skill packs', '');
  L.push('A pack practises part of what an expectation asks; the note under each mapping says which part. Mapped expectations still link to the full official text.', '');
  for (const p of SKILL_PACKS) {
    L.push(`- \`${p.id}\` — ${p.title}`);
    for (const e of p.expectations) {
      const x = byId.get(e.id);
      const c = x ? b.courses.find((cc) => cc.id === x.courseId) : undefined;
      L.push(`  - ${x && c ? `${c.code ?? `Grade ${c.grades.join('–')}`} ${x.index}` : `${e.id} (missing)`}: ${e.note}`);
    }
  }
  L.push('', '## Courses published only as PDF', '');
  L.push('These are listed (code, title, grade, type and a link to the Ministry PDF) but their expectations are not imported, because the Ministry does not publish them as structured data. FlowCompanion does not extract or paraphrase them.', '');
  for (const c of pdf) L.push(`- ${courseLabel(c)}${c.pdf ? ` — ${c.pdf.url}` : ''}`);
  L.push('', '## Import checks', '');
  L.push(`- Duplicates removed: ${b.report.duplicatesRemoved.length ? b.report.duplicatesRemoved.join('; ') : 'none'}`);
  L.push(`- Warnings: ${b.report.warnings.length ? b.report.warnings.join('; ') : 'none'}`);
  L.push(`- Skipped: ${b.report.skipped.length ? b.report.skipped.join('; ') : 'none'}`, '');
  L.push('## How this is verified', '');
  L.push('- `npm run curriculum:verify` downloads the live Ministry data again and compares it with the shipped bundle record by record (added, removed or reworded expectations and courses). It exits non-zero on any difference.');
  L.push('- In the app, Student Learning → Coverage → "Check the Ministry site for changes" does the same comparison and only applies changes when asked, keeping the earlier wording in the revision history.');
  L.push('- Curriculum files imported by hand are always marked unverified.');
  L.push('- `tests/unit/content.test.ts` checks that every skill-pack mapping points at a real expectation and that every generated answer key passes an independent recomputation.');
  L.push('');
  return L.join('\n');
}

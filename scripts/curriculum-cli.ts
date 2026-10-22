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
} else {
  console.error(`Unknown command ${cmd}. Use fetch, verify or summary.`);
  process.exit(64);
}

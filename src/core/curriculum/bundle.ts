import { createHash } from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {
  CurriculumBundleSchema,
  validateBundle,
  type CurriculumBundle,
  type CurriculumCourse,
  type CurriculumExpectation,
} from '../../shared/curriculum/types';

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);

/** Hash of the official wording of an expectation. Teacher supports are hashed separately. */
export function expectationHash(e: Pick<CurriculumExpectation, 'kind' | 'index' | 'title' | 'text' | 'parentId'>): string {
  return sha(JSON.stringify([e.kind, e.index, e.title, e.text, e.parentId]));
}
export function supportsHash(e: Pick<CurriculumExpectation, 'supports'>): string {
  return sha(JSON.stringify(e.supports.map((s) => [s.kind, s.text])));
}
export function courseHash(c: CurriculumCourse): string {
  return sha(JSON.stringify([c.code, c.name, c.grades, c.courseType, c.prerequisites, c.description, c.yearIssued, c.expectationsSource]));
}
export function bundleHash(b: CurriculumBundle): string {
  return sha(
    JSON.stringify([
      b.courses.map((c) => [c.id, courseHash(c)]),
      b.expectations.map((e) => [e.id, expectationHash(e), supportsHash(e)]),
      b.documents.map((d) => [d.id, d.year, d.revisions.length]),
    ]),
  );
}

export class BundleError extends Error {
  constructor(
    message: string,
    readonly problems: string[],
  ) {
    super(message);
    this.name = 'BundleError';
  }
}

/** Parses and checks a bundle. Throws BundleError listing every problem found. */
export function parseBundle(raw: unknown): CurriculumBundle {
  const r = CurriculumBundleSchema.safeParse(raw);
  if (!r.success) {
    throw new BundleError(
      'This is not a valid curriculum file.',
      r.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  const problems = validateBundle(r.data);
  if (problems.length) throw new BundleError(`The curriculum file has ${problems.length} problem${problems.length === 1 ? '' : 's'}.`, problems.slice(0, 50));
  return r.data;
}

export function readBundleFile(file: string): CurriculumBundle {
  const buf = fs.readFileSync(file);
  const text = file.endsWith('.gz') ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  return parseBundle(JSON.parse(text));
}

export function writeBundleFile(file: string, b: CurriculumBundle): void {
  const text = JSON.stringify(b);
  fs.writeFileSync(file, file.endsWith('.gz') ? zlib.gzipSync(text, { level: 9 }) : text);
}

export interface BundleDiff {
  addedCourses: string[];
  removedCourses: string[];
  changedCourses: string[];
  added: string[];
  removed: string[];
  /** Official wording changed. */
  changed: { id: string; before: string; after: string }[];
  /** Only the Ministry's teacher supports changed. */
  supportsChanged: string[];
}

export function diffBundles(before: CurriculumBundle | null, after: CurriculumBundle): BundleDiff {
  const oldCourses = new Map((before?.courses ?? []).map((c) => [c.id, c]));
  const newCourses = new Map(after.courses.map((c) => [c.id, c]));
  const oldExp = new Map((before?.expectations ?? []).map((e) => [e.id, e]));
  const newExp = new Map(after.expectations.map((e) => [e.id, e]));
  const d: BundleDiff = { addedCourses: [], removedCourses: [], changedCourses: [], added: [], removed: [], changed: [], supportsChanged: [] };
  for (const [id, c] of newCourses) {
    const o = oldCourses.get(id);
    if (!o) d.addedCourses.push(id);
    else if (courseHash(o) !== courseHash(c)) d.changedCourses.push(id);
  }
  for (const id of oldCourses.keys()) if (!newCourses.has(id)) d.removedCourses.push(id);
  for (const [id, e] of newExp) {
    const o = oldExp.get(id);
    if (!o) d.added.push(id);
    else if (expectationHash(o) !== expectationHash(e)) d.changed.push({ id, before: o.text, after: e.text });
    else if (supportsHash(o) !== supportsHash(e)) d.supportsChanged.push(id);
  }
  for (const id of oldExp.keys()) if (!newExp.has(id)) d.removed.push(id);
  return d;
}

export function diffSummary(d: BundleDiff): string {
  const parts = [
    d.addedCourses.length && `${d.addedCourses.length} new course${d.addedCourses.length === 1 ? '' : 's'}`,
    d.removedCourses.length && `${d.removedCourses.length} course${d.removedCourses.length === 1 ? '' : 's'} no longer published`,
    d.changedCourses.length && `${d.changedCourses.length} course description${d.changedCourses.length === 1 ? '' : 's'} changed`,
    d.added.length && `${d.added.length} new expectation${d.added.length === 1 ? '' : 's'}`,
    d.changed.length && `${d.changed.length} expectation${d.changed.length === 1 ? '' : 's'} reworded`,
    d.removed.length && `${d.removed.length} expectation${d.removed.length === 1 ? '' : 's'} removed`,
    d.supportsChanged.length && `teacher supports updated for ${d.supportsChanged.length} expectation${d.supportsChanged.length === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No changes';
}

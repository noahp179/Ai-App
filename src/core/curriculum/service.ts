import { courseLabel, type CurriculumBundle, type CurriculumCourse, type CurriculumDocument, type Support, type VerificationStatus } from '../../shared/curriculum/types';
import type {
  CourseDetail,
  CourseSummary,
  CoverageReport,
  CoverageRow,
  CurriculumImport,
  CurriculumOverview,
  CurriculumSearchHit,
  CurriculumUpdateCheck,
  ExpectationDetail,
  ExpectationRow,
  RevisionEntry,
  StrandView,
  SubjectSummary,
} from '../../shared/curriculum/views';
import type { Db } from '../db/database';
import { ftsQuery, json } from '../db/database';
import { type Clock, NotFoundError, UserError, newId } from '../util';
import { bundleHash, courseHash, diffBundles, diffSummary, expectationHash, parseBundle, supportsHash, type BundleDiff } from './bundle';
import { fetchDcpBundle } from './dcp';

/**
 * The local curriculum store. It lives in its own database file (it is reference data, rebuilt from the
 * bundled snapshot if lost) and keeps every import, so changes to Ministry wording are tracked over time.
 */

const SCHEMA_VERSION = 1;

function migrate(db: Db): void {
  if (db.userVersion >= SCHEMA_VERSION) return;
  db.tx(() => {
    db.exec(`
      CREATE TABLE curriculum_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE curriculum_imports (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        official INTEGER NOT NULL,
        fetched_at TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        bundle_hash TEXT NOT NULL,
        summary TEXT NOT NULL,
        counts TEXT NOT NULL,
        report TEXT NOT NULL
      );
      CREATE TABLE curriculum_documents (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        level TEXT NOT NULL,
        title TEXT NOT NULL,
        verification TEXT NOT NULL,
        import_id TEXT NOT NULL
      );
      CREATE TABLE curriculum_courses (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        code TEXT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        grade_min INTEGER NOT NULL,
        grade_max INTEGER NOT NULL,
        data TEXT NOT NULL,
        hash TEXT NOT NULL,
        verification TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        first_import TEXT NOT NULL,
        changed_import TEXT NOT NULL,
        removed_at TEXT
      );
      CREATE INDEX curriculum_courses_doc ON curriculum_courses(document_id);
      CREATE TABLE curriculum_strands (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        idx TEXT NOT NULL,
        title TEXT NOT NULL,
        sort INTEGER NOT NULL
      );
      CREATE INDEX curriculum_strands_course ON curriculum_strands(course_id);
      CREATE TABLE curriculum_expectations (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        strand_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        parent_id TEXT,
        idx TEXT NOT NULL,
        title TEXT NOT NULL,
        html TEXT NOT NULL,
        text TEXT NOT NULL,
        url TEXT NOT NULL,
        sort INTEGER NOT NULL,
        supports TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_modified TEXT NOT NULL,
        hash TEXT NOT NULL,
        supports_hash TEXT NOT NULL,
        verification TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        first_import TEXT NOT NULL,
        changed_import TEXT NOT NULL,
        removed_at TEXT
      );
      CREATE INDEX curriculum_expectations_course ON curriculum_expectations(course_id, sort);
      CREATE INDEX curriculum_expectations_parent ON curriculum_expectations(parent_id);
      CREATE TABLE curriculum_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        change TEXT NOT NULL,
        before_text TEXT,
        after_text TEXT,
        at TEXT NOT NULL
      );
      CREATE INDEX curriculum_revisions_record ON curriculum_revisions(record_id);
      CREATE VIRTUAL TABLE curriculum_fts USING fts5(
        ref_id UNINDEXED, course_id UNINDEXED, kind UNINDEXED, idx, title, body,
        tokenize = 'unicode61 remove_diacritics 2'
      );
    `);
    db.userVersion = SCHEMA_VERSION;
  });
}

interface CourseRow {
  id: string;
  document_id: string;
  data: string;
  verification: VerificationStatus;
  checked_at: string;
  removed_at: string | null;
}
interface ExpRow {
  id: string;
  course_id: string;
  strand_id: string;
  kind: 'overall' | 'specific';
  parent_id: string | null;
  idx: string;
  title: string;
  html: string;
  text: string;
  url: string;
  sort: number;
  supports: string;
  verification: VerificationStatus;
  checked_at: string;
  source_id: string;
  source_modified: string;
  removed_at: string | null;
}

/** Which expectations have teaching content, for the coverage report. */
export interface CoverageSource {
  lessons(): Set<string>;
  practice(): Set<string>;
  assessments(): Set<string>;
  aiOnly(): Set<string>;
}

export interface CurriculumServiceDeps {
  db: Db;
  clock: Clock;
  /** Shipped snapshot; null when none is available (tests may import directly). */
  loadBundled: (() => CurriculumBundle) | null;
  fetch?: typeof fetch;
  userAgent?: string;
}

export class CurriculumService {
  private pending: { bundle: CurriculumBundle; check: CurriculumUpdateCheck } | null = null;
  private docCache = new Map<string, CurriculumDocument>();
  private checking: Promise<CurriculumUpdateCheck> | null = null;

  constructor(private readonly d: CurriculumServiceDeps) {
    migrate(d.db);
  }

  private get db() {
    return this.d.db;
  }
  private now() {
    return this.d.clock.now().toISOString();
  }
  private meta(key: string): string | null {
    return this.db.get<{ value: string }>('SELECT value FROM curriculum_meta WHERE key = ?', [key])?.value ?? null;
  }
  private setMeta(key: string, value: string): void {
    this.db.run('INSERT INTO curriculum_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
  }

  /** Imports the shipped snapshot when it differs from what was last imported from it. Returns the import, if any. */
  ensureBundled(): CurriculumImport | null {
    if (!this.d.loadBundled) return null;
    const bundle = this.d.loadBundled();
    const hash = bundleHash(bundle);
    if (this.meta('bundled_hash') === hash && this.db.get('SELECT 1 FROM curriculum_courses LIMIT 1')) return null;
    // A newer official import from the live site is kept if the shipped snapshot is older.
    const last = this.lastOfficial();
    if (last && last.source === 'live' && last.fetchedAt > bundle.fetchedAt && this.meta('bundled_hash')) {
      this.setMeta('bundled_hash', hash);
      return null;
    }
    const r = this.importBundle(bundle, 'bundled');
    this.setMeta('bundled_hash', hash);
    return r;
  }

  private lastOfficial(): CurriculumImport | null {
    const r = this.db.get<Record<string, string | number>>("SELECT * FROM curriculum_imports WHERE official = 1 ORDER BY imported_at DESC, rowid DESC LIMIT 1");
    return r ? this.toImport(r) : null;
  }

  private toImport(r: Record<string, string | number>): CurriculumImport {
    return {
      id: String(r.id),
      source: r.source as CurriculumImport['source'],
      official: r.official === 1,
      fetchedAt: String(r.fetched_at),
      importedAt: String(r.imported_at),
      summary: String(r.summary),
      counts: json(r.counts, { courses: 0, expectations: 0 }),
    };
  }

  /** Current official records rebuilt as a bundle, for diffing against a new one. */
  private currentOfficial(): CurriculumBundle | null {
    const courses = this.db.all<CourseRow>("SELECT * FROM curriculum_courses WHERE removed_at IS NULL AND verification != 'unverified'");
    if (!courses.length) return null;
    const exps = this.db.all<ExpRow>("SELECT * FROM curriculum_expectations WHERE removed_at IS NULL AND verification != 'unverified'");
    return {
      courses: courses.map((c) => json<CurriculumCourse>(c.data, null as never)),
      expectations: exps.map((e) => ({ ...this.rowToExp(e), supports: json<Support[]>(e.supports, []), sourceId: e.source_id, sourceModified: e.source_modified, sort: e.sort })),
    } as unknown as CurriculumBundle;
  }

  /**
   * Writes a bundle into the store and records what changed. Official bundles replace official records;
   * records missing from a newer official bundle are kept but marked as no longer published.
   */
  importBundle(raw: CurriculumBundle, source: 'bundled' | 'live' | 'file'): CurriculumImport {
    const bundle = parseBundle(raw);
    const official = source !== 'file' && bundle.source.official;
    const now = this.now();
    const importId = newId();
    const diff: BundleDiff = official ? diffBundles(this.currentOfficial(), bundle) : diffBundles(null, bundle);
    const report = { ...bundle.report, skippedExisting: [] as string[] };
    const firstImport = !this.db.get('SELECT 1 FROM curriculum_imports LIMIT 1');

    this.db.tx(() => {
      const existingIds = new Set(this.db.all<{ id: string }>("SELECT id FROM curriculum_expectations WHERE verification != 'unverified'").map((r) => r.id));
      const existingCourses = new Set(this.db.all<{ id: string }>("SELECT id FROM curriculum_courses WHERE verification != 'unverified'").map((r) => r.id));
      for (const doc of bundle.documents) {
        if (!official && this.db.get('SELECT 1 FROM curriculum_documents WHERE id = ?', [doc.id])) continue;
        this.db.run(
          `INSERT INTO curriculum_documents (id, data, level, title, verification, import_id) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, level = excluded.level, title = excluded.title, verification = excluded.verification, import_id = excluded.import_id`,
          [doc.id, JSON.stringify(doc), doc.level, doc.title, official ? 'verified' : 'unverified', importId],
        );
      }
      const changedCourses = new Set([...diff.addedCourses, ...diff.changedCourses]);
      for (const c of bundle.courses) {
        if (!official && existingCourses.has(c.id)) {
          report.skippedExisting.push(c.id);
          continue;
        }
        const verification: VerificationStatus = !official ? 'unverified' : c.expectationsSource === 'pdf' ? 'pdf_only' : 'verified';
        this.db.run(
          `INSERT INTO curriculum_courses (id, document_id, code, name, subject, grade_min, grade_max, data, hash, verification, checked_at, first_import, changed_import, removed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT(id) DO UPDATE SET document_id = excluded.document_id, code = excluded.code, name = excluded.name, subject = excluded.subject,
             grade_min = excluded.grade_min, grade_max = excluded.grade_max, data = excluded.data, hash = excluded.hash, verification = excluded.verification,
             checked_at = excluded.checked_at, changed_import = CASE WHEN curriculum_courses.hash = excluded.hash THEN curriculum_courses.changed_import ELSE excluded.changed_import END,
             removed_at = NULL`,
          [c.id, c.documentId, c.code, c.name, c.subject, Math.min(...c.grades), Math.max(...c.grades), JSON.stringify(c), courseHash(c), verification, bundle.fetchedAt, importId, importId],
        );
        if (official && !firstImport && changedCourses.has(c.id)) {
          this.db.run('INSERT INTO curriculum_revisions (import_id, record_type, record_id, change, before_text, after_text, at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
            importId,
            'course',
            c.id,
            diff.addedCourses.includes(c.id) ? 'added' : 'changed',
            null,
            c.description,
            now,
          ]);
        }
      }
      if (official) {
        this.db.run("DELETE FROM curriculum_strands WHERE course_id IN (SELECT id FROM curriculum_courses WHERE verification != 'unverified')");
      }
      for (const s of bundle.strands) {
        if (!official && existingCourses.has(s.courseId)) continue;
        this.db.run('INSERT INTO curriculum_strands (id, course_id, idx, title, sort) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET idx = excluded.idx, title = excluded.title, sort = excluded.sort', [
          s.id,
          s.courseId,
          s.index,
          s.title,
          s.sort,
        ]);
      }
      const changedText = new Map(diff.changed.map((c) => [c.id, c]));
      const supportsChanged = new Set(diff.supportsChanged);
      const added = new Set(diff.added);
      for (const e of bundle.expectations) {
        if (!official && (existingIds.has(e.id) || existingCourses.has(e.courseId))) {
          report.skippedExisting.push(e.id);
          continue;
        }
        this.db.run(
          `INSERT INTO curriculum_expectations (id, course_id, strand_id, kind, parent_id, idx, title, html, text, url, sort, supports, source_id, source_modified, hash, supports_hash, verification, checked_at, first_import, changed_import, removed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT(id) DO UPDATE SET course_id = excluded.course_id, strand_id = excluded.strand_id, kind = excluded.kind, parent_id = excluded.parent_id, idx = excluded.idx,
             title = excluded.title, html = excluded.html, text = excluded.text, url = excluded.url, sort = excluded.sort, supports = excluded.supports, source_id = excluded.source_id,
             source_modified = excluded.source_modified, verification = excluded.verification, checked_at = excluded.checked_at,
             changed_import = CASE WHEN curriculum_expectations.hash = excluded.hash THEN curriculum_expectations.changed_import ELSE excluded.changed_import END,
             hash = excluded.hash, supports_hash = excluded.supports_hash, removed_at = NULL`,
          [
            e.id,
            e.courseId,
            e.strandId,
            e.kind,
            e.parentId,
            e.index,
            e.title,
            e.html,
            e.text,
            e.url,
            e.sort,
            JSON.stringify(e.supports),
            e.sourceId,
            e.sourceModified,
            expectationHash(e),
            supportsHash(e),
            official ? 'verified' : 'unverified',
            bundle.fetchedAt,
            importId,
            importId,
          ],
        );
        if (official && !firstImport && (added.has(e.id) || changedText.has(e.id) || supportsChanged.has(e.id))) {
          const ch = changedText.get(e.id);
          this.db.run('INSERT INTO curriculum_revisions (import_id, record_type, record_id, change, before_text, after_text, at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
            importId,
            'expectation',
            e.id,
            added.has(e.id) ? 'added' : ch ? 'changed' : 'supports',
            ch?.before ?? null,
            ch ? ch.after : null,
            now,
          ]);
        }
      }
      if (official) {
        for (const id of diff.removed) {
          this.db.run("UPDATE curriculum_expectations SET removed_at = ?, verification = 'removed_upstream' WHERE id = ?", [now, id]);
          this.db.run('INSERT INTO curriculum_revisions (import_id, record_type, record_id, change, before_text, after_text, at) VALUES (?, ?, ?, ?, NULL, NULL, ?)', [importId, 'expectation', id, 'removed', now]);
        }
        for (const id of diff.removedCourses) {
          this.db.run("UPDATE curriculum_courses SET removed_at = ?, verification = 'removed_upstream' WHERE id = ?", [now, id]);
          this.db.run('INSERT INTO curriculum_revisions (import_id, record_type, record_id, change, before_text, after_text, at) VALUES (?, ?, ?, ?, NULL, NULL, ?)', [importId, 'course', id, 'removed', now]);
        }
      }
      this.rebuildSearch();
      const counts = { courses: bundle.courses.length, expectations: bundle.expectations.length };
      const summary = firstImport ? 'First import' : diffSummary(diff);
      this.db.run('INSERT INTO curriculum_imports (id, source, official, fetched_at, imported_at, bundle_hash, summary, counts, report) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        importId,
        source,
        official ? 1 : 0,
        bundle.fetchedAt,
        now,
        bundleHash(bundle),
        official ? summary : `Imported from a file (not verified): ${report.skippedExisting.length ? `${report.skippedExisting.length} records already in the official curriculum were skipped` : 'all records added'}`,
        JSON.stringify(counts),
        JSON.stringify(report),
      ]);
      if (official) {
        this.setMeta(
          'source',
          JSON.stringify({ name: bundle.source.name, site: bundle.source.site, copyright: bundle.source.copyright, terms: bundle.source.terms, fetchedAt: bundle.fetchedAt, importedAt: now, bundleHash: bundleHash(bundle) }),
        );
      }
    });
    this.docCache.clear();
    return this.toImport(this.db.get<Record<string, string | number>>('SELECT * FROM curriculum_imports WHERE id = ?', [importId])!);
  }

  private rebuildSearch(): void {
    this.db.run('DELETE FROM curriculum_fts');
    this.db.run(
      `INSERT INTO curriculum_fts (ref_id, course_id, kind, idx, title, body)
       SELECT id, course_id, kind, idx, title, text FROM curriculum_expectations WHERE removed_at IS NULL`,
    );
    this.db.run(
      `INSERT INTO curriculum_fts (ref_id, course_id, kind, idx, title, body)
       SELECT id, id, 'course', COALESCE(code, ''), name, json_extract(data, '$.description') FROM curriculum_courses WHERE removed_at IS NULL`,
    );
  }

  // ─────────── Reading ───────────

  private documentOf(id: string): CurriculumDocument {
    let d = this.docCache.get(id);
    if (!d) {
      const r = this.db.get<{ data: string }>('SELECT data FROM curriculum_documents WHERE id = ?', [id]);
      if (!r) throw new NotFoundError('That curriculum document');
      d = json<CurriculumDocument>(r.data, null as never);
      this.docCache.set(id, d);
    }
    return d;
  }

  private counts(): Map<string, { overall: number; specific: number }> {
    const m = new Map<string, { overall: number; specific: number }>();
    for (const r of this.db.all<{ course_id: string; kind: string; n: number }>('SELECT course_id, kind, COUNT(*) AS n FROM curriculum_expectations WHERE removed_at IS NULL GROUP BY course_id, kind')) {
      const c = m.get(r.course_id) ?? { overall: 0, specific: 0 };
      if (r.kind === 'overall') c.overall = r.n;
      else c.specific = r.n;
      m.set(r.course_id, c);
    }
    return m;
  }

  private toSummary(r: CourseRow, counts?: Map<string, { overall: number; specific: number }>): CourseSummary {
    const c = json<CurriculumCourse>(r.data, null as never);
    const doc = this.documentOf(r.document_id);
    const n = counts?.get(r.id) ?? this.counts().get(r.id) ?? { overall: 0, specific: 0 };
    return { ...c, label: courseLabel(c), documentTitle: doc.title, level: doc.level, verification: r.verification, checkedAt: r.checked_at, overallCount: n.overall, specificCount: n.specific };
  }

  private rowToExp(r: ExpRow): ExpectationRow {
    return {
      id: r.id,
      courseId: r.course_id,
      strandId: r.strand_id,
      kind: r.kind,
      parentId: r.parent_id,
      index: r.idx,
      title: r.title,
      html: r.html,
      text: r.text,
      url: r.url,
      verification: r.verification,
      checkedAt: r.checked_at,
      supportCount: json<unknown[]>(r.supports, []).length,
    };
  }

  hasData(): boolean {
    return !!this.db.get('SELECT 1 FROM curriculum_courses WHERE removed_at IS NULL LIMIT 1');
  }

  overview(): CurriculumOverview {
    const source = json<CurriculumOverview['source'] | null>(this.meta('source'), null);
    if (!source) throw new UserError('No curriculum has been imported yet.', 'not_configured');
    const courses = this.db.all<CourseRow & { grade_min: number; grade_max: number }>('SELECT * FROM curriculum_courses WHERE removed_at IS NULL');
    const counts = this.counts();
    const grades = new Set<number>();
    const subjects = new Map<string, SubjectSummary>();
    let unverified = 0;
    for (const r of courses) {
      const c = json<CurriculumCourse>(r.data, null as never);
      c.grades.forEach((g) => grades.add(g));
      if (r.verification === 'unverified') unverified++;
      const doc = this.documentOf(r.document_id);
      const s = subjects.get(doc.id) ?? { documentId: doc.id, title: doc.title, level: doc.level, year: doc.year, courseCount: 0, digitalCourseCount: 0, specificCount: 0, grades: [] };
      s.courseCount++;
      if (c.expectationsSource === 'digital') s.digitalCourseCount++;
      s.specificCount += counts.get(r.id)?.specific ?? 0;
      s.grades = [...new Set([...s.grades, ...c.grades])].sort((a, b) => a - b);
      subjects.set(doc.id, s);
    }
    const n = (sql: string) => this.db.get<{ n: number }>(sql)!.n;
    return {
      source: { ...source, lastCheckedAt: this.meta('last_check_at'), lastCheckResult: this.meta('last_check_result') },
      grades: [...grades].sort((a, b) => a - b),
      documents: subjects.size,
      courses: courses.length,
      digitalCourses: courses.filter((r) => json<CurriculumCourse>(r.data, null as never).expectationsSource === 'digital').length,
      pdfOnlyCourses: courses.filter((r) => r.verification === 'pdf_only').length,
      overall: n("SELECT COUNT(*) AS n FROM curriculum_expectations WHERE removed_at IS NULL AND kind = 'overall'"),
      specific: n("SELECT COUNT(*) AS n FROM curriculum_expectations WHERE removed_at IS NULL AND kind = 'specific'"),
      unverified: unverified + n("SELECT COUNT(*) AS n FROM curriculum_expectations WHERE removed_at IS NULL AND verification = 'unverified'"),
      changedUpstream: n("SELECT COUNT(*) AS n FROM curriculum_expectations WHERE verification = 'changed_upstream'"),
      subjects: [...subjects.values()].sort((a, b) => a.level.localeCompare(b.level) || a.title.localeCompare(b.title)),
    };
  }

  courses(q: { grade?: number | null; documentId?: string | null; search?: string | null } = {}): CourseSummary[] {
    const where = ['removed_at IS NULL'];
    const params: (string | number)[] = [];
    if (q.grade) {
      where.push('grade_min <= ? AND grade_max >= ?');
      params.push(q.grade, q.grade);
    }
    if (q.documentId) {
      where.push('document_id = ?');
      params.push(q.documentId);
    }
    const counts = this.counts();
    let list = this.db.all<CourseRow>(`SELECT * FROM curriculum_courses WHERE ${where.join(' AND ')} ORDER BY grade_min, COALESCE(code, name)`, params).map((r) => this.toSummary(r, counts));
    const term = q.search?.trim().toLowerCase();
    if (term) list = list.filter((c) => `${c.code ?? ''} ${c.label} ${c.subject} ${c.documentTitle}`.toLowerCase().includes(term));
    return list;
  }

  course(id: string): CourseDetail {
    const r = this.db.get<CourseRow>('SELECT * FROM curriculum_courses WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That course');
    const course = this.toSummary(r);
    const strands = this.db.all<{ id: string; idx: string; title: string }>('SELECT id, idx, title FROM curriculum_strands WHERE course_id = ? ORDER BY sort', [id]);
    const exps = this.db.all<ExpRow>('SELECT * FROM curriculum_expectations WHERE course_id = ? AND removed_at IS NULL ORDER BY sort', [id]).map((e) => this.rowToExp(e));
    const views: StrandView[] = strands.map((s) => ({
      id: s.id,
      index: s.idx,
      title: s.title,
      overall: exps.filter((e) => e.strandId === s.id && e.kind === 'overall').map((o) => ({ ...o, specifics: exps.filter((e) => e.parentId === o.id) })),
    }));
    const all = this.courses();
    const prerequisiteCourses = course.prerequisites.map((text) => {
      const lower = text.toLowerCase();
      const hit = all.find((c) => c.code && lower.includes(c.code.toLowerCase())) ?? all.find((c) => c.level === 'secondary' && lower === `${c.name}, grade ${c.grades[0]}, ${(c.courseType ?? '').toLowerCase()}`.toLowerCase());
      return { text, courseId: hit?.id ?? null };
    });
    return { course, document: this.documentOf(r.document_id), strands: views, prerequisiteCourses };
  }

  expectation(id: string): ExpectationDetail {
    const r = this.db.get<ExpRow>('SELECT * FROM curriculum_expectations WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That curriculum expectation');
    const course = this.db.get<CourseRow>('SELECT * FROM curriculum_courses WHERE id = ?', [r.course_id]);
    if (!course) throw new NotFoundError('That course');
    const parentRow = r.parent_id ? this.db.get<ExpRow>('SELECT * FROM curriculum_expectations WHERE id = ?', [r.parent_id]) : undefined;
    const strand = this.db.get<{ id: string; idx: string; title: string }>('SELECT id, idx, title FROM curriculum_strands WHERE id = ?', [r.strand_id]) ?? { id: r.strand_id, idx: '', title: '' };
    return {
      ...this.rowToExp(r),
      supports: json<Support[]>(r.supports, []),
      course: this.toSummary(course),
      document: this.documentOf(course.document_id),
      strand: { id: strand.id, index: strand.idx, title: strand.title },
      parent: parentRow ? this.rowToExp(parentRow) : null,
      specifics: r.kind === 'overall' ? this.db.all<ExpRow>('SELECT * FROM curriculum_expectations WHERE parent_id = ? AND removed_at IS NULL ORDER BY sort', [id]).map((e) => this.rowToExp(e)) : [],
      revisions: this.revisionsOf(id),
    };
  }

  /** Lightweight lookup used by other services (lessons, mastery). Returns null for unknown ids. */
  find(id: string): (ExpectationRow & { courseLabel: string; grades: number[]; subject: string; documentTitle: string }) | null {
    const r = this.db.get<ExpRow>('SELECT * FROM curriculum_expectations WHERE id = ?', [id]);
    if (!r) return null;
    const c = this.db.get<CourseRow>('SELECT * FROM curriculum_courses WHERE id = ?', [r.course_id]);
    if (!c) return null;
    const course = json<CurriculumCourse>(c.data, null as never);
    return { ...this.rowToExp(r), courseLabel: courseLabel(course), grades: course.grades, subject: course.subject, documentTitle: this.documentOf(c.document_id).title };
  }

  supportsOf(id: string): Support[] {
    return json<Support[]>(this.db.get<{ supports: string }>('SELECT supports FROM curriculum_expectations WHERE id = ?', [id])?.supports, []);
  }

  courseOf(id: string): CourseSummary | null {
    const r = this.db.get<CourseRow>('SELECT * FROM curriculum_courses WHERE id = ?', [id]);
    return r ? this.toSummary(r) : null;
  }

  expectationsOf(courseId: string, kind: 'overall' | 'specific' = 'specific'): ExpectationRow[] {
    return this.db.all<ExpRow>('SELECT * FROM curriculum_expectations WHERE course_id = ? AND kind = ? AND removed_at IS NULL ORDER BY sort', [courseId, kind]).map((e) => this.rowToExp(e));
  }

  private revisionsOf(id: string): RevisionEntry[] {
    return this.db
      .all<{ at: string; import_id: string; change: RevisionEntry['change']; before_text: string | null; after_text: string | null }>(
        'SELECT at, import_id, change, before_text, after_text FROM curriculum_revisions WHERE record_id = ? ORDER BY id DESC LIMIT 20',
        [id],
      )
      .map((r) => ({ at: r.at, importId: r.import_id, change: r.change, before: r.before_text, after: r.after_text }));
  }

  search(q: string, opts: { grade?: number | null; limit?: number } = {}): CurriculumSearchHit[] {
    const fts = ftsQuery(q);
    if (!fts) return [];
    const rows = this.db.all<{ ref_id: string; course_id: string; kind: string; idx: string; title: string; snip: string }>(
      `SELECT ref_id, course_id, kind, idx, title, snippet(curriculum_fts, 5, '', '', '…', 24) AS snip FROM curriculum_fts WHERE curriculum_fts MATCH ? ORDER BY rank LIMIT ?`,
      [fts, Math.min(200, (opts.limit ?? 40) * 3)],
    );
    const courseCache = new Map<string, CurriculumCourse | null>();
    const courseOf = (id: string) => {
      if (!courseCache.has(id)) {
        const r = this.db.get<{ data: string }>('SELECT data FROM curriculum_courses WHERE id = ? AND removed_at IS NULL', [id]);
        courseCache.set(id, r ? json<CurriculumCourse>(r.data, null as never) : null);
      }
      return courseCache.get(id) ?? null;
    };
    const out: CurriculumSearchHit[] = [];
    for (const r of rows) {
      const c = courseOf(r.course_id);
      if (!c) continue;
      if (opts.grade && !c.grades.includes(opts.grade)) continue;
      out.push(
        r.kind === 'course'
          ? { type: 'course', id: r.ref_id, courseId: r.course_id, title: courseLabel(c), snippet: r.snip, grades: c.grades }
          : { type: 'expectation', id: r.ref_id, courseId: r.course_id, title: `${r.idx} · ${courseLabel(c)}`, snippet: r.snip, grades: c.grades },
      );
      if (out.length >= (opts.limit ?? 40)) break;
    }
    return out;
  }

  imports(limit = 20): CurriculumImport[] {
    return this.db.all<Record<string, string | number>>('SELECT * FROM curriculum_imports ORDER BY imported_at DESC, rowid DESC LIMIT ?', [limit]).map((r) => this.toImport(r));
  }

  recentRevisions(limit = 50): (RevisionEntry & { recordId: string; recordType: string })[] {
    return this.db
      .all<{ at: string; import_id: string; change: RevisionEntry['change']; before_text: string | null; after_text: string | null; record_id: string; record_type: string }>(
        "SELECT * FROM curriculum_revisions WHERE change != 'supports' ORDER BY id DESC LIMIT ?",
        [limit],
      )
      .map((r) => ({ at: r.at, importId: r.import_id, change: r.change, before: r.before_text, after: r.after_text, recordId: r.record_id, recordType: r.record_type }));
  }

  // ─────────── Live verification ───────────

  /**
   * Downloads the current curriculum from the Ministry site and compares it with the local copy. Nothing is
   * changed until applyUpdate() is called; differing records are marked "changed upstream" meanwhile.
   * Only public curriculum pages are requested; no personal data is sent.
   */
  async checkForUpdates(onProgress?: (m: string) => void): Promise<CurriculumUpdateCheck> {
    if (!this.d.fetch) throw new UserError('Checking for curriculum updates is not available here.');
    if (this.checking) return this.checking;
    this.checking = (async () => {
      let requests = 0;
      try {
        const bundle = await fetchDcpBundle({
          fetch: (...args) => {
            requests++;
            return this.d.fetch!(...args);
          },
          delayMs: 150,
          onProgress,
          userAgent: this.d.userAgent,
        });
        const parsed = parseBundle(bundle);
        const diff = diffBundles(this.currentOfficial(), parsed);
        const now = this.now();
        const check: CurriculumUpdateCheck = {
          checkedAt: now,
          fetchedAt: parsed.fetchedAt,
          summary: diffSummary(diff),
          hasChanges: diff.added.length + diff.removed.length + diff.changed.length + diff.addedCourses.length + diff.removedCourses.length + diff.changedCourses.length + diff.supportsChanged.length > 0,
          addedCourses: diff.addedCourses,
          removedCourses: diff.removedCourses,
          changed: diff.changed.slice(0, 200),
          added: diff.added.length,
          removed: diff.removed.length,
          supportsChanged: diff.supportsChanged.length,
          requests,
        };
        this.db.tx(() => {
          this.db.run("UPDATE curriculum_expectations SET checked_at = ? WHERE verification = 'verified'", [now]);
          this.db.run("UPDATE curriculum_courses SET checked_at = ? WHERE verification IN ('verified', 'pdf_only')", [now]);
          for (const c of diff.changed) this.db.run("UPDATE curriculum_expectations SET verification = 'changed_upstream' WHERE id = ?", [c.id]);
          this.setMeta('last_check_at', now);
          this.setMeta('last_check_result', check.summary);
        });
        this.pending = check.hasChanges ? { bundle: parsed, check } : null;
        return check;
      } catch (err) {
        this.setMeta('last_check_at', this.now());
        this.setMeta('last_check_result', `Failed: ${err instanceof Error ? err.message : String(err)}`);
        throw err instanceof UserError ? err : new UserError(err instanceof Error ? err.message : String(err), 'network');
      } finally {
        this.checking = null;
      }
    })();
    return this.checking;
  }

  pendingUpdate(): CurriculumUpdateCheck | null {
    return this.pending?.check ?? null;
  }

  applyUpdate(): CurriculumImport {
    if (!this.pending) throw new UserError('There is no downloaded update to apply. Check for updates first.');
    const r = this.importBundle(this.pending.bundle, 'live');
    this.pending = null;
    return r;
  }

  /** Imports a curriculum file someone else prepared. Its records are always marked unverified. */
  importFile(raw: unknown): CurriculumImport {
    const b = raw as CurriculumBundle;
    if (b && typeof b === 'object' && b.source && typeof b.source === 'object') b.source.official = false;
    return this.importBundle(parseBundle(b), 'file');
  }

  // ─────────── Coverage ───────────

  coverage(content: CoverageSource): CoverageReport {
    const lessons = content.lessons();
    const practice = content.practice();
    const assessments = content.assessments();
    const ai = content.aiOnly();
    const rows: CoverageRow[] = [];
    const specByCourse = new Map<string, string[]>();
    for (const r of this.db.all<{ id: string; course_id: string }>("SELECT id, course_id FROM curriculum_expectations WHERE kind = 'specific' AND removed_at IS NULL")) {
      const l = specByCourse.get(r.course_id) ?? [];
      l.push(r.id);
      specByCourse.set(r.course_id, l);
    }
    for (const c of this.courses()) {
      const ids = specByCourse.get(c.id) ?? [];
      rows.push({
        courseId: c.id,
        label: c.label,
        grades: c.grades,
        subject: c.documentTitle,
        level: c.level,
        verification: c.verification,
        expectationsSource: c.expectationsSource,
        specific: ids.length,
        withLessons: ids.filter((i) => lessons.has(i)).length,
        withPractice: ids.filter((i) => practice.has(i)).length,
        withAssessment: ids.filter((i) => assessments.has(i)).length,
        withAiOnly: ids.filter((i) => ai.has(i) && !lessons.has(i)).length,
        checkedAt: c.checkedAt,
      });
    }
    const sum = (k: 'specific' | 'withLessons' | 'withPractice' | 'withAssessment') => rows.reduce((a, r) => a + r[k], 0);
    const totals = {
      courses: rows.length,
      specific: sum('specific'),
      withLessons: sum('withLessons'),
      withPractice: sum('withPractice'),
      withAssessment: sum('withAssessment'),
      pdfOnlyCourses: rows.filter((r) => r.expectationsSource === 'pdf').length,
      unverified: rows.filter((r) => r.verification === 'unverified').length,
    };
    const fullCourses = rows.filter((r) => r.specific > 0 && r.withLessons === r.specific && r.withPractice === r.specific);
    const pct = (n: number) => (totals.specific ? `${((100 * n) / totals.specific).toFixed(1)}%` : '0%');
    const statement =
      `FlowCompanion lists ${totals.courses} Grade ${Math.min(...rows.flatMap((r) => r.grades))}–${Math.max(...rows.flatMap((r) => r.grades))} courses and ${totals.specific} specific expectations from the Ontario curriculum. ` +
      `Offline lessons exist for ${totals.withLessons} of them (${pct(totals.withLessons)}) and automatically checked practice for ${totals.withPractice} (${pct(totals.withPractice)}). ` +
      `${fullCourses.length ? `${fullCourses.length} course${fullCourses.length === 1 ? ' is' : 's are'} fully covered.` : 'No course is fully covered yet.'} ` +
      `${totals.pdfOnlyCourses} course${totals.pdfOnlyCourses === 1 ? ' is' : 's are'} only published as PDFs, so their expectations are not in the app. ` +
      'Everything else can be studied with an AI tutor, whose lessons are generated and not reviewed.';
    const meta = json<{ fetchedAt: string } | null>(this.meta('source'), null);
    return { generatedAt: this.now(), fetchedAt: meta?.fetchedAt ?? '', totals, rows, statement };
  }
}

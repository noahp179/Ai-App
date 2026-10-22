import type { CurriculumCourse, CurriculumDocument, Support, VerificationStatus } from './types';

/** What the UI sees of the curriculum store. Official text is always paired with its source and status. */

export interface CurriculumSourceInfo {
  name: string;
  site: string;
  copyright: string;
  terms: string;
  fetchedAt: string;
  importedAt: string;
  lastCheckedAt: string | null;
  lastCheckResult: string | null;
  bundleHash: string;
}

export interface CourseSummary extends CurriculumCourse {
  label: string;
  documentTitle: string;
  level: 'elementary' | 'secondary';
  verification: VerificationStatus;
  checkedAt: string;
  overallCount: number;
  specificCount: number;
}

export interface ExpectationRow {
  id: string;
  courseId: string;
  strandId: string;
  kind: 'overall' | 'specific';
  parentId: string | null;
  index: string;
  title: string;
  html: string;
  text: string;
  url: string;
  verification: VerificationStatus;
  checkedAt: string;
  supportCount: number;
}

export interface StrandView {
  id: string;
  index: string;
  title: string;
  overall: (ExpectationRow & { specifics: ExpectationRow[] })[];
}

export interface CourseDetail {
  course: CourseSummary;
  document: CurriculumDocument;
  strands: StrandView[];
  /** Courses the Ministry lists as prerequisites that exist in the catalogue. */
  prerequisiteCourses: { text: string; courseId: string | null }[];
}

export interface RevisionEntry {
  at: string;
  importId: string;
  change: 'added' | 'changed' | 'removed' | 'supports';
  before: string | null;
  after: string | null;
}

export interface ExpectationDetail extends ExpectationRow {
  supports: Support[];
  course: CourseSummary;
  document: CurriculumDocument;
  strand: { id: string; index: string; title: string };
  parent: ExpectationRow | null;
  specifics: ExpectationRow[];
  revisions: RevisionEntry[];
}

export interface SubjectSummary {
  documentId: string;
  title: string;
  level: 'elementary' | 'secondary';
  year: string | null;
  courseCount: number;
  digitalCourseCount: number;
  specificCount: number;
  grades: number[];
}

export interface CurriculumOverview {
  source: CurriculumSourceInfo;
  grades: number[];
  documents: number;
  courses: number;
  digitalCourses: number;
  pdfOnlyCourses: number;
  overall: number;
  specific: number;
  unverified: number;
  changedUpstream: number;
  subjects: SubjectSummary[];
}

export interface CurriculumSearchHit {
  type: 'course' | 'expectation';
  id: string;
  courseId: string;
  title: string;
  snippet: string;
  grades: number[];
}

export interface CurriculumImport {
  id: string;
  source: 'bundled' | 'live' | 'file';
  official: boolean;
  fetchedAt: string;
  importedAt: string;
  summary: string;
  counts: { courses: number; expectations: number };
}

export interface CurriculumUpdateCheck {
  checkedAt: string;
  fetchedAt: string;
  summary: string;
  hasChanges: boolean;
  addedCourses: string[];
  removedCourses: string[];
  changed: { id: string; before: string; after: string }[];
  added: number;
  removed: number;
  supportsChanged: number;
  requests: number;
}

export interface CoverageRow {
  courseId: string;
  label: string;
  grades: number[];
  subject: string;
  level: 'elementary' | 'secondary';
  verification: VerificationStatus;
  expectationsSource: 'digital' | 'pdf';
  specific: number;
  withLessons: number;
  withPractice: number;
  withAssessment: number;
  withAiOnly: number;
  checkedAt: string;
}

export interface CoverageReport {
  generatedAt: string;
  fetchedAt: string;
  totals: { courses: number; specific: number; withLessons: number; withPractice: number; withAssessment: number; pdfOnlyCourses: number; unverified: number };
  rows: CoverageRow[];
  /** Plain statement of what is and is not covered, generated from the numbers. */
  statement: string;
}

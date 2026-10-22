import { z } from 'zod';

/**
 * Normalized Ontario curriculum records. Official text (expectations, course descriptions, prerequisites)
 * is stored exactly as published by the Ministry of Education, as a restricted HTML subset plus a plain-text
 * rendering; nothing here is paraphrased or generated.
 */

export const CURRICULUM_FORMAT = 'flowcompanion.curriculum';
export const DCP_SITE = 'https://www.dcp.edu.gov.on.ca/en/';
export const DCP_API = 'https://ws.api.dcp.edu.gov.on.ca/content/api/';
export const CROWN_COPYRIGHT_TERMS = 'https://www.ontario.ca/page/copyright-information';

/** Official records come from the Ministry; imported files are kept apart and never shown as official. */
export const VERIFICATION_STATUSES = ['verified', 'pdf_only', 'unverified', 'changed_upstream', 'removed_upstream'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: 'Official text, imported from the Ministry of Education',
  pdf_only: 'Course listed by the Ministry; expectations are only published as a PDF and were not imported',
  unverified: 'Not verified against an official source',
  changed_upstream: 'The Ministry has changed this text since it was imported',
  removed_upstream: 'No longer published by the Ministry',
};

const RichTextSchema = z.object({
  /** Restricted HTML: p, ul, ol, li, em, strong, sup, sub, br and span.term only. */
  html: z.string(),
  text: z.string(),
});
export type RichText = z.infer<typeof RichTextSchema>;

const SourceLinkSchema = z.object({ title: z.string().min(1), url: z.string().regex(/^https:\/\//) });
export type SourceLink = z.infer<typeof SourceLinkSchema>;

export const SupportSchema = z.object({
  /** The Ministry's own label, e.g. "Key Concepts" or "Sample tasks". */
  kind: z.string().min(1),
  html: z.string(),
  text: z.string(),
  /** True when an image or embedded item was left out; it can be seen on the Ministry page. */
  omittedMedia: z.boolean(),
});
export type Support = z.infer<typeof SupportSchema>;

export const DocumentSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1),
  subject: z.string().min(1),
  level: z.enum(['elementary', 'secondary']),
  /** Year printed in the King's Printer notice for the curriculum, when published. */
  year: z.string().nullable(),
  url: z.string().regex(/^https:\/\//),
  sourceDocuments: z.array(SourceLinkSchema),
  revisions: z.array(z.object({ date: z.string(), title: z.string(), description: z.string() })),
  sourceId: z.string(),
  sourceModified: z.string(),
});
export type CurriculumDocument = z.infer<typeof DocumentSchema>;

export const CourseSchema = z.object({
  id: z.string().regex(/^on-[a-z0-9-]+$/),
  documentId: z.string(),
  /** Ontario course code (secondary only), e.g. "MTH1W". */
  code: z.string().nullable(),
  name: z.string().min(1),
  subject: z.string().min(1),
  grades: z.array(z.number().int().min(1).max(12)).min(1),
  /** The Ministry's course type, e.g. "University Preparation", "De-streamed" or "Open". */
  courseType: z.string().nullable(),
  prerequisites: z.array(z.string()),
  description: z.string(),
  yearIssued: z.string().nullable(),
  url: z.string().regex(/^https:\/\//),
  /** "digital": expectations imported; "pdf": the Ministry only publishes this course's expectations as a PDF. */
  expectationsSource: z.enum(['digital', 'pdf']),
  pdf: SourceLinkSchema.nullable(),
  sourceId: z.string(),
  sourceModified: z.string(),
});
export type CurriculumCourse = z.infer<typeof CourseSchema>;

export const StrandSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  index: z.string(),
  title: z.string().min(1),
  sort: z.number().int(),
  sourceId: z.string(),
});
export type CurriculumStrand = z.infer<typeof StrandSchema>;

export const ExpectationSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  strandId: z.string(),
  kind: z.enum(['overall', 'specific']),
  /** For a specific expectation, its overall expectation. */
  parentId: z.string().nullable(),
  /** The Ministry's number, e.g. "B2.1". */
  index: z.string(),
  /** Heading the Ministry gives an overall expectation (often empty for specific ones). */
  title: z.string(),
  html: z.string(),
  text: z.string(),
  url: z.string().regex(/^https:\/\//),
  sort: z.number().int(),
  supports: z.array(SupportSchema),
  sourceId: z.string(),
  sourceModified: z.string(),
});
export type CurriculumExpectation = z.infer<typeof ExpectationSchema>;

export const IngestReportSchema = z.object({
  duplicatesRemoved: z.array(z.string()),
  warnings: z.array(z.string()),
  skipped: z.array(z.string()),
});
export type IngestReport = z.infer<typeof IngestReportSchema>;

export const CurriculumBundleSchema = z.object({
  format: z.literal(CURRICULUM_FORMAT),
  version: z.literal(1),
  jurisdiction: z.literal('Ontario, Canada'),
  source: z.object({
    name: z.string(),
    site: z.string(),
    api: z.string(),
    copyright: z.string(),
    terms: z.string(),
    official: z.boolean(),
  }),
  fetchedAt: z.string(),
  grades: z.array(z.number().int()),
  documents: z.array(DocumentSchema),
  courses: z.array(CourseSchema),
  strands: z.array(StrandSchema),
  expectations: z.array(ExpectationSchema),
  report: IngestReportSchema,
});
export type CurriculumBundle = z.infer<typeof CurriculumBundleSchema>;

/** Structural checks beyond the schema: unique ids, every reference resolves, official links. Returns problems found. */
export function validateBundle(b: CurriculumBundle): string[] {
  const problems: string[] = [];
  const dup = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`Duplicate ${kind} id ${id}`);
      seen.add(id);
    }
    return seen;
  };
  const docs = dup('document', b.documents.map((d) => d.id));
  const courses = dup('course', b.courses.map((c) => c.id));
  const strands = dup('strand', b.strands.map((s) => s.id));
  const exps = dup('expectation', b.expectations.map((e) => e.id));
  const codes = b.courses.filter((c) => c.code).map((c) => c.code!.toUpperCase());
  if (new Set(codes).size !== codes.length) problems.push('Two courses share a course code');
  for (const c of b.courses) {
    if (!docs.has(c.documentId)) problems.push(`Course ${c.id} refers to a missing document`);
    if (b.source.official && !c.url.startsWith(DCP_SITE)) problems.push(`Course ${c.id} does not link to the Ministry site`);
  }
  for (const s of b.strands) if (!courses.has(s.courseId)) problems.push(`Strand ${s.id} refers to a missing course`);
  const byId = new Map(b.expectations.map((e) => [e.id, e]));
  for (const e of b.expectations) {
    if (!courses.has(e.courseId)) problems.push(`Expectation ${e.id} refers to a missing course`);
    if (!strands.has(e.strandId)) problems.push(`Expectation ${e.id} refers to a missing strand`);
    if (e.kind === 'specific') {
      const p = e.parentId ? byId.get(e.parentId) : undefined;
      if (!p || p.kind !== 'overall') problems.push(`Specific expectation ${e.id} has no overall expectation`);
    } else if (e.parentId) problems.push(`Overall expectation ${e.id} should not have a parent`);
    if (!e.text.trim()) problems.push(`Expectation ${e.id} has no text`);
    if (b.source.official && !e.url.startsWith(DCP_SITE)) problems.push(`Expectation ${e.id} does not link to the Ministry site`);
  }
  for (const c of b.courses) {
    const n = b.expectations.filter((e) => e.courseId === c.id).length;
    if (c.expectationsSource === 'digital' && n === 0) problems.push(`Course ${c.id} is marked digital but has no expectations`);
    if (c.expectationsSource === 'pdf' && n > 0) problems.push(`Course ${c.id} is PDF-only but has expectations`);
  }
  void exps;
  return problems;
}

/** Display name for a course, e.g. "Mathematics, Grade 9, De-streamed (MTH1W)" or "Mathematics, Grade 7". */
export function courseLabel(c: Pick<CurriculumCourse, 'name' | 'grades' | 'courseType' | 'code'>): string {
  const g = c.grades.length === 1 ? `Grade ${c.grades[0]}` : `Grades ${c.grades[0]}–${c.grades[c.grades.length - 1]}`;
  return [c.name, g, c.courseType].filter(Boolean).join(', ') + (c.code ? ` (${c.code})` : '');
}

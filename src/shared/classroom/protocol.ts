import { z } from 'zod';
import type { Block, CheckResult, Question, Response, RubricCriterion } from '../study/types';

/**
 * Wire protocol of the FlowCompanion classroom service. Request bodies are zod schemas (validated on the server and
 * usable on clients); responses are plain interfaces. Shared by the server, the desktop app and the browser build.
 */
export const CLASSROOM_API = '/api/v1';
export const CLASSROOM_VERSION = '1.0.0';

export const USER_ROLES = ['admin', 'teacher', 'student'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type ClassRole = 'teacher' | 'co_teacher' | 'student';

export const AI_MODES = ['off', 'materials', 'hints', 'open'] as const;
export type AiMode = (typeof AI_MODES)[number];
export const AI_MODE_LABEL: Record<AiMode, string> = {
  off: 'AI assistant off',
  materials: 'Materials-only tutor',
  hints: 'Hints only',
  open: 'Open explanations',
};
/** What students are told before they start. */
export const AI_MODE_STUDENT: Record<AiMode, string> = {
  off: 'There is no AI assistant in this assessment.',
  materials: 'The AI assistant can explain and quote your teacher’s materials. It will not give answers to the assessment questions.',
  hints: 'The AI assistant gives hints and guiding questions only. It will not explain answers in full or give answers to the questions.',
  open: 'The AI assistant can explain ideas fully, but it will not write your answers for you.',
};

export const ASSESSMENT_KINDS = ['practice', 'quiz', 'test', 'assignment'] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];
export const ASSESSMENT_KIND_LABEL: Record<AssessmentKind, string> = { practice: 'Practice quiz (ungraded)', quiz: 'Quiz', test: 'Test', assignment: 'Written assignment' };

export const INTEGRITY_KINDS = ['paste_blocked', 'copy_blocked', 'drop_blocked', 'focus_lost', 'large_insert', 'rule_change_attempt'] as const;
export type IntegrityKind = (typeof INTEGRITY_KINDS)[number];

export const MATERIAL_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};
export const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;
export const MAX_CLASS_MATERIAL_BYTES = 500 * 1024 * 1024;

// ─────────── Rubrics ───────────

export const LEVELS = [1, 2, 3, 4] as const;

/** Default rubric for how a student used the AI assistant. Teachers can edit it per assessment. */
export const DEFAULT_AI_USE_RUBRIC: RubricCriterion[] = [
  {
    id: 'understanding',
    label: 'Seeks understanding',
    description: 'Asks how or why and asks for concepts to be explained, rather than asking for answers.',
    levels: ['Mostly asks for answers or final results.', 'Sometimes asks for explanations, often asks for answers.', 'Usually asks how or why; rarely asks for answers.', 'Consistently asks to understand ideas and builds on the explanations.'],
  },
  {
    id: 'materials',
    label: 'Uses the materials',
    description: 'Asks about and refers to the sources the teacher provided.',
    levels: ['Does not refer to the materials.', 'Refers to the materials once or vaguely.', 'Asks about specific parts of the materials.', 'Connects several parts of the materials and checks them against each other.'],
  },
  {
    id: 'critical',
    label: 'Thinks critically about AI output',
    description: 'Checks, questions or corrects the assistant instead of accepting everything.',
    levels: ['Accepts everything without question.', 'Occasionally asks a follow-up.', 'Asks the assistant to justify or clarify its answers.', 'Tests the assistant’s claims, spots problems and asks for evidence.'],
  },
  {
    id: 'honesty',
    label: 'Academic honesty',
    description: 'Does not try to get answers to the assessment questions, paste questions to get answers, or change the assistant’s rules. Judged from the transcript only.',
    levels: ['Repeatedly tries to get answers or to change the assistant’s rules.', 'Tries once or twice to get an answer, then stops.', 'Stays within the rules; any slip is minor.', 'Stays within the rules throughout and says when something would cross the line.'],
  },
  {
    id: 'prompts',
    label: 'Prompt quality',
    description: 'Prompts are specific, give context and improve over the conversation.',
    levels: ['Prompts are one or two words or unclear.', 'Prompts are understandable but general.', 'Prompts are specific and give context.', 'Prompts are specific, give context and are refined in response to the answers.'],
  },
];

const RubricCriterionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  description: z.string().max(600).default(''),
  levels: z.array(z.string().max(400)).length(4),
});

// ─────────── Accounts ───────────

const Login = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[^\s]+$/, 'Use an email or a username without spaces.');
const Password = z.string().min(8, 'Use at least 8 characters.').max(200);
const Name = z.string().trim().min(1).max(60);

export const CreateSchoolBody = z.object({ schoolName: z.string().trim().min(2).max(120), displayName: Name, login: Login, password: Password, setupCode: z.string().max(200).optional() });
export const SignInBody = z.object({ login: Login, password: z.string().min(1).max(200) });
export const RegisterTeacherBody = z.object({ inviteCode: z.string().trim().min(4).max(40), displayName: Name, login: Login, password: Password });
/** A student joins with a class code; the account is created if `password` is new, or signed in if it exists. */
export const JoinClassBody = z.object({ code: z.string().trim().min(4).max(40), displayName: Name.optional(), login: Login.optional(), password: Password.optional() });

export interface UserDto {
  id: string;
  schoolId: string;
  schoolName: string;
  role: UserRole;
  displayName: string;
  login: string;
}
export interface SessionDto {
  token: string;
  user: UserDto;
}
export interface ServerInfo {
  name: string;
  version: string;
  /** Whether a new school can be created without a setup code. */
  openSetup: boolean;
  schools: number;
  /** What the server can and cannot do, shown honestly in the client. */
  capabilities: { ai: boolean; antivirus: 'engine' | 'basic'; storage: string; sso: false };
}

// ─────────── Classes ───────────

export const ClassBody = z.object({
  name: z.string().trim().min(1).max(120),
  section: z.string().trim().max(60).default(''),
  schoolYear: z.string().trim().max(20).default(''),
  /** Ontario course id from the curriculum engine, e.g. "on-mth1w". */
  courseId: z.string().max(80).nullable().default(null),
  courseLabel: z.string().max(200).nullable().default(null),
  /** Last day of the class; retention counts from here. */
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  mayIncludeUnder13: z.boolean().default(false),
});
export const JoinCodeBody = z.object({ expiresInDays: z.number().int().min(1).max(365).default(14), requireApproval: z.boolean().default(false) });
export const RosterBody = z.object({ csv: z.string().max(400_000), commit: z.boolean().default(false) });
export const MemberBody = z.object({ action: z.enum(['approve', 'remove', 'make_co_teacher']) });
export const CoTeacherBody = z.object({ login: Login });

export interface ClassDto {
  id: string;
  name: string;
  section: string;
  schoolYear: string;
  courseId: string | null;
  courseLabel: string | null;
  endsOn: string | null;
  mayIncludeUnder13: boolean;
  archived: boolean;
  myRole: ClassRole;
  students: number;
  pending: number;
}
export interface MemberDto {
  userId: string;
  displayName: string;
  login: string;
  role: ClassRole;
  status: 'active' | 'pending' | 'removed';
  joinedAt: string;
}
export interface JoinCodeDto {
  code: string;
  expiresAt: string;
  requireApproval: boolean;
}
export interface RosterRow {
  line: number;
  displayName: string;
  login: string;
  error: string | null;
  /** Set after commit for accounts that were created: a one-time password to hand to the student. */
  temporaryPassword?: string;
  existing?: boolean;
}
export interface RosterResult {
  committed: boolean;
  rows: RosterRow[];
  created: number;
  added: number;
  errors: number;
}

// ─────────── Materials ───────────

export interface MaterialDto {
  id: string;
  classId: string;
  folder: string;
  name: string;
  mime: string;
  size: number;
  version: number;
  /** ready: text extracted. unreadable: stored, but no text could be read. (Files that fail the safety scan are refused and never stored.) */
  status: 'ready' | 'unreadable';
  statusDetail: string;
  pages: number;
  /** How the file was checked: an antivirus engine, or basic checks only. */
  scan: string;
  createdAt: string;
  updatedAt: string;
}
export const MaterialPatch = z.object({ name: z.string().trim().min(1).max(160).optional(), folder: z.string().trim().max(80).optional() });

// ─────────── Assessments ───────────

export const AssessmentSettingsSchema = z.object({
  kind: z.enum(ASSESSMENT_KINDS).default('quiz'),
  opensAt: z.string().datetime().nullable().default(null),
  closesAt: z.string().datetime().nullable().default(null),
  timeLimitMinutes: z.number().int().min(1).max(600).nullable().default(null),
  attempts: z.number().int().min(1).max(10).default(1),
  shuffleQuestions: z.boolean().default(false),
  shuffleChoices: z.boolean().default(false),
  showResults: z.enum(['immediately', 'on_release']).default('on_release'),
  layout: z.enum(['one', 'all']).default('one'),
  aiMode: z.enum(AI_MODES).default('materials'),
  allowGeneralKnowledge: z.boolean().default(false),
  messageLimit: z.number().int().min(1).max(200).nullable().default(null),
  transcriptVisible: z.boolean().default(true),
  blockPaste: z.boolean().default(true),
  logFocus: z.boolean().default(true),
  largeInsertSignal: z.boolean().default(true),
  largeInsertChars: z.number().int().min(50).max(5000).default(200),
  evaluateAiUse: z.boolean().default(true),
  aiUseRubric: z.array(RubricCriterionSchema).min(1).max(8).default(DEFAULT_AI_USE_RUBRIC),
});
export type AssessmentSettings = z.infer<typeof AssessmentSettingsSchema>;

export const AssessmentBody = z.object({
  title: z.string().trim().min(1).max(160),
  instructions: z.string().max(4000).default(''),
  settings: AssessmentSettingsSchema.prefault({}),
  materialIds: z.array(z.string().max(64)).max(20).default([]),
});
export const AssessmentPatch = AssessmentBody.partial();

/** A question as teachers write it. Validated in full on the server (see items.ts). */
export const ItemBody = z.object({
  points: z.number().min(0).max(100).default(1),
  question: z.record(z.string(), z.unknown()),
  long: z.boolean().default(false),
  expectationIds: z.array(z.string().max(120)).max(12).default([]),
});
export const ItemPatch = ItemBody.partial().extend({ reviewed: z.boolean().optional() });
export const ReorderBody = z.object({ itemIds: z.array(z.string().max(64)).max(200) });
export const DraftItemsBody = z.object({ count: z.number().int().min(1).max(10).default(5), focus: z.string().max(500).default('') });
export const ImportItemsBody = z.object({ json: z.string().max(2_000_000) });
export const AccommodationBody = z.object({
  extraTimePercent: z.number().int().min(0).max(300).default(0),
  pasteAllowed: z.boolean().default(false),
  textToSpeech: z.boolean().default(false),
  largerText: z.boolean().default(false),
  note: z.string().max(300).default(''),
});
export type Accommodation = z.infer<typeof AccommodationBody>;

export type AssessmentPhase = 'draft' | 'scheduled' | 'open' | 'closed';
export interface AssessmentDto {
  id: string;
  classId: string;
  title: string;
  instructions: string;
  status: 'draft' | 'published';
  phase: AssessmentPhase;
  version: number;
  settings: AssessmentSettings;
  materialIds: string[];
  items: number;
  points: number;
  /** Teacher view only. */
  unreviewedAiItems?: number;
  submissions?: number;
  toGrade?: number;
  released?: number;
  createdAt: string;
  updatedAt: string;
  /** Student view only. */
  my?: { attemptsUsed: number; attemptId: string | null; status: 'not_started' | 'in_progress' | 'submitted' | 'released'; score: number | null };
}
export interface ItemDto {
  id: string;
  position: number;
  points: number;
  question: Question;
  long: boolean;
  aiDrafted: boolean;
  reviewed: boolean;
  expectationIds: string[];
}

// ─────────── Attempts (student) ───────────

export const StartAttemptBody = z.object({ acknowledged: z.literal(true) });
export const AutosaveBody = z.object({
  responses: z.record(z.string().max(64), z.record(z.string(), z.unknown()).nullable()).default({}),
  flags: z.array(z.string().max(64)).max(200).optional(),
  /** Seconds spent per item since the last save. */
  seconds: z.record(z.string().max(64), z.number().min(0).max(3600)).default({}),
});
export const ChatBody = z.object({ text: z.string().trim().min(1).max(4000), draftForItem: z.string().max(64).nullable().default(null) });
export const IntegrityBatchBody = z.object({
  events: z
    .array(
      z.object({
        kind: z.enum(['paste_blocked', 'copy_blocked', 'drop_blocked', 'focus_lost', 'large_insert']),
        itemId: z.string().max(64).nullable().default(null),
        at: z.string().datetime(),
        detail: z.object({ how: z.string().max(40).optional(), chars: z.number().int().min(0).max(1_000_000).optional(), ms: z.number().int().min(0).max(86_400_000).optional(), where: z.string().max(40).optional() }).default({}),
      }),
    )
    .max(100),
});

export interface CitationDto {
  materialId: string;
  title: string;
  /** 1-based page or slide, when the source has them. */
  page: number | null;
  quote: string;
}
export interface ChatMessageDto {
  id: string;
  role: 'student' | 'assistant';
  content: string;
  citations: CitationDto[];
  /** draft: the student pressed "Ask about my draft" and the draft was sent with the question. */
  kind: 'message' | 'draft';
  status: 'complete' | 'streaming' | 'refused' | 'error';
  error: string | null;
  createdAt: string;
}
export type ChatStreamEvent = { type: 'start'; student: ChatMessageDto; assistant: ChatMessageDto } | { type: 'delta'; text: string } | { type: 'done'; assistant: ChatMessageDto } | { type: 'error'; message: string; assistant?: ChatMessageDto };

export interface StudentItemDto {
  id: string;
  position: number;
  points: number;
  /** Answer keys and solutions removed. */
  question: Question;
  long: boolean;
}
export interface AttemptDto {
  id: string;
  assessmentId: string;
  classId: string;
  title: string;
  instructions: string;
  number: number;
  status: 'in_progress' | 'submitted';
  startedAt: string;
  /** Server time when work stops being accepted; null when there is no limit. */
  deadline: string | null;
  serverNow: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  reference: string | null;
  settings: Pick<AssessmentSettings, 'kind' | 'layout' | 'aiMode' | 'messageLimit' | 'blockPaste' | 'logFocus' | 'largeInsertSignal' | 'largeInsertChars' | 'transcriptVisible' | 'showResults'>;
  accommodation: Accommodation;
  items: StudentItemDto[];
  responses: Record<string, Response>;
  flags: string[];
  messagesUsed: number;
  materials: { id: string; name: string; pages: number }[];
}
/** Shown before starting: what is recorded and what is not. */
export interface AssessmentIntroDto {
  assessment: Pick<AssessmentDto, 'id' | 'title' | 'instructions' | 'phase' | 'items' | 'points'> & { settings: AssessmentSettings };
  accommodation: Accommodation;
  attemptsUsed: number;
  inProgress: string | null;
  recorded: string[];
  neverRecorded: string[];
  limits: string;
}

// ─────────── Grading and review (teacher) ───────────

export interface IntegrityEventDto {
  id: string;
  kind: IntegrityKind;
  itemId: string | null;
  at: string;
  detail: { how?: string; chars?: number; ms?: number; where?: string; text?: string };
}
export interface WrittenSuggestion {
  levels: { criterionId: string; level: number; quote: string; rationale: string }[];
  feedback: string;
  score: number;
  /** True when the AI quoted text that is not in the answer; those quotes were dropped. */
  evidenceRemoved: boolean;
  model: string;
}
export interface HighlightDto {
  start: number;
  end: number;
  comment: string;
}
export interface GradeDto {
  itemId: string;
  /** From the deterministic checker, when the item can be checked by code. */
  auto: { score: number; result: CheckResult } | null;
  /** "AI-suggested": never counted until a teacher confirms. */
  suggestion: WrittenSuggestion | null;
  suggestionStatus: 'none' | 'queued' | 'running' | 'done' | 'invalid' | 'failed';
  suggestionError: string | null;
  /** The mark that counts. null until it is decided. */
  score: number | null;
  source: 'auto' | 'teacher' | null;
  levels: Record<string, number> | null;
  overrideReason: string;
  comment: string;
  highlights: HighlightDto[];
}
export const GradeBody = z.object({
  score: z.number().min(0).max(100),
  levels: z.record(z.string().max(40), z.number().int().min(1).max(4)).nullable().default(null),
  overrideReason: z.string().max(500).default(''),
  comment: z.string().max(4000).default(''),
  highlights: z.array(z.object({ start: z.number().int().min(0), end: z.number().int().min(0), comment: z.string().max(1000) })).max(50).default([]),
});
export const OverallFeedbackBody = z.object({ comment: z.string().max(6000) });
export const EvaluationReviewBody = z.object({ levels: z.record(z.string().max(40), z.number().int().min(1).max(4)), comment: z.string().max(4000).default('') });
export const StudentReplyBody = z.object({ text: z.string().trim().min(1).max(1500) });
export const ReleaseBody = z.object({ attemptIds: z.array(z.string().max(64)).max(500).nullable().default(null), release: z.boolean().default(true) });
export const CommentBankBody = z.object({ text: z.string().trim().min(1).max(600) });
export const BatchBody = z.object({ what: z.enum(['evaluate', 'grade_written']) });

export interface EvaluationDto {
  status: 'none' | 'queued' | 'running' | 'done' | 'invalid' | 'failed';
  error: string | null;
  rubric: RubricCriterion[];
  suggested: {
    criteria: { criterionId: string; level: number; quotes: { messageId: string; text: string }[]; rationale: string }[];
    summary: string;
    flags: string[];
  } | null;
  evidenceRemoved: boolean;
  model: string | null;
  /** The teacher's decision; the only version students see. */
  final: { levels: Record<string, number>; comment: string; reviewedAt: string } | null;
  studentReply: string | null;
}
export interface OverlapDto {
  itemId: string;
  /** Share of the answer's word 4-grams that also appear in the assistant's messages (0..1). */
  similarity: number;
  passages: { text: string; answerStart: number; answerEnd: number; messageId: string }[];
}
export interface SnapshotDto {
  itemId: string;
  at: string;
  text: string;
}
export interface SubmissionDto {
  attempt: { id: string; number: number; status: 'in_progress' | 'submitted'; startedAt: string; deadline: string | null; submittedAt: string | null; autoSubmitted: boolean; reference: string | null; version: number; released: boolean };
  student: { id: string; displayName: string };
  assessment: { id: string; title: string; classId: string; settings: AssessmentSettings };
  items: ItemDto[];
  responses: Record<string, Response>;
  seconds: Record<string, number>;
  grades: GradeDto[];
  overallComment: string;
  total: { score: number | null; max: number; decided: number; of: number };
  chat: ChatMessageDto[];
  events: IntegrityEventDto[];
  snapshots: SnapshotDto[];
  evaluation: EvaluationDto;
  overlap: OverlapDto[];
  accommodation: Accommodation;
}
export interface SubmissionRow {
  attemptId: string | null;
  student: { id: string; displayName: string };
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'released';
  submittedAt: string | null;
  score: number | null;
  max: number;
  toGrade: number;
  evaluation: EvaluationDto['status'];
  evaluationReviewed: boolean;
  /** Plain counts; never a ranking or a verdict. */
  signals: { pasteAttempts: number; focusLosses: number; largeInserts: number; ruleChangeAttempts: number; messages: number; maxOverlap: number };
  hasAccommodation: boolean;
}
export interface BatchStatusDto {
  running: boolean;
  what: 'evaluate' | 'grade_written' | null;
  total: number;
  done: number;
  failed: number;
  queuedForBudget: number;
}
export interface ClassOverviewDto {
  assessmentId: string;
  completion: { students: number; started: number; submitted: number; graded: number; released: number };
  scores: { buckets: number[]; mean: number | null; max: number };
  questions: { itemId: string; position: number; type: string; answered: number; correct: number | null; meanScore: number | null; points: number; commonWrong: { answer: string; count: number; misconception: string | null }[] }[];
  aiUse: { evaluated: number; criteria: { criterionId: string; label: string; counts: [number, number, number, number] }[] };
}
export interface GradebookDto {
  assessments: { id: string; title: string; points: number; kind: AssessmentKind }[];
  students: { id: string; displayName: string }[];
  cells: Record<string, { status: SubmissionRow['status']; score: number | null; max: number }>;
}

/** What a student sees once results are released. */
export interface ResultDto {
  attemptId: string;
  title: string;
  submittedAt: string | null;
  released: boolean;
  total: { score: number | null; max: number };
  overallComment: string;
  items: { item: StudentItemDto; response: Response | null; score: number | null; points: number; levels: Record<string, number> | null; comment: string; highlights: HighlightDto[]; correctAnswer: string | null; solution: Block[] }[];
  transcript: ChatMessageDto[] | null;
  evaluation: { rubric: RubricCriterion[]; levels: Record<string, number>; comment: string; evidence: { criterionId: string; quotes: { messageId: string; text: string }[] }[]; studentReply: string | null } | null;
}

// ─────────── Admin ───────────

export const SchoolSettingsSchema = z.object({
  aiModel: z.string().trim().min(1).max(80).default('claude-opus-5-5'),
  assistantEffort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('medium'),
  gradingEffort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('high'),
  /** US dollars per month; null means no limit. */
  monthlyBudget: z.number().min(0).max(1_000_000).nullable().default(null),
  /** US dollars per million tokens, used to estimate cost from token counts. */
  prices: z.object({ input: z.number().min(0).default(4), output: z.number().min(0).default(20), cacheRead: z.number().min(0).default(0.2), cacheWrite: z.number().min(0).default(5) }).prefault({}),
  /** Days after a class's end date before its data is deleted. */
  retentionDays: z.number().int().min(0).max(3650).default(365),
  dataRegion: z.string().trim().max(80).default('Not set'),
  /** Whether administrators may open student chats (always written to the audit log). Off by default. */
  adminCanViewChats: z.boolean().default(false),
});
export type SchoolSettings = z.infer<typeof SchoolSettingsSchema>;
export const SchoolSettingsPatch = SchoolSettingsSchema.partial().extend({ aiKey: z.string().max(400).nullable().optional(), under13Consent: z.boolean().optional() });

export interface SchoolAdminDto {
  school: { id: string; name: string };
  settings: SchoolSettings;
  aiKey: { set: boolean; hint: string | null; source: 'school' | 'server' | 'none' };
  under13Consent: { confirmedBy: string; at: string } | null;
  teacherInvite: { code: string; expiresAt: string } | null;
  usage: { month: string; cost: number; inputTokens: number; outputTokens: number; requests: number; budget: number | null; state: 'ok' | 'warning' | 'paused' };
  teachers: { id: string; displayName: string; login: string; role: UserRole; classes: number }[];
}
export interface AuditEntryDto {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}
export interface UsageRowDto {
  classId: string;
  className: string;
  assessmentId: string | null;
  assessmentTitle: string | null;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export type { Block, CheckResult, Question, Response, RubricCriterion };

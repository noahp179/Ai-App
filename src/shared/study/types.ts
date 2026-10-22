import type { Weekday } from '../types';

/**
 * Student learning: profiles, lessons, questions, quizzes, mastery and plans. Everything a student does is
 * stored per student profile and only on this computer.
 */

export const GRADES = [6, 7, 8, 9, 10, 11, 12] as const;
export type Grade = (typeof GRADES)[number];

// ─────────── Content blocks ───────────

/** Text may contain $$…$$ LaTeX, rendered with KaTeX. */
export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'math'; latex: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'note'; tone: 'tip' | 'warn' | 'source'; text: string }
  | { kind: 'diagram'; diagram: Diagram; alt: string }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'code'; code: string; language: 'python' | 'pseudocode' }
  | { kind: 'steps'; steps: { text: string; math?: string }[] }
  /** Official Ministry wording, always shown with its number, course and source link. */
  | { kind: 'official'; expectationId: string; index: string; course: string; html: string; url: string }
  /** A Ministry teacher support (e.g. "Key Concepts"), quoted with its source. */
  | { kind: 'support'; label: string; html: string; omittedMedia: boolean; url: string };

export type Diagram =
  | { type: 'fraction_bar'; parts: number; shaded: number; label?: string }
  | { type: 'number_line'; min: number; max: number; step: number; points: { at: number; label: string }[]; jumps?: { from: number; to: number; label: string }[] }
  | { type: 'area_model'; rows: number; cols: number; shadedRows: number; shadedCols: number }
  | { type: 'right_triangle'; a: string; b: string; c: string }
  | { type: 'circle'; label: string; show: 'radius' | 'diameter' }
  | { type: 'coordinate'; points: { x: number; y: number; label: string }[]; line?: { m: number; b: number } }
  | { type: 'angle_pair'; kind: 'supplementary' | 'complementary' | 'opposite'; known: number; unknownLabel: string }
  | { type: 'prism'; l: number; w: number; h: number; unit: string };

// ─────────── Questions ───────────

export const QUESTION_TYPES = [
  'multiple_choice',
  'multiple_select',
  'true_false',
  'numeric',
  'expression',
  'short_answer',
  'fill_blank',
  'matching',
  'ordering',
  'written',
  'code_trace',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  multiple_select: 'Choose all that apply',
  true_false: 'True or false',
  numeric: 'Number answer',
  expression: 'Algebra answer',
  short_answer: 'Short answer',
  fill_blank: 'Fill in the blank',
  matching: 'Matching',
  ordering: 'Put in order',
  written: 'Written explanation',
  code_trace: 'Read the code',
};

/** 1 = prerequisite/foundation, 2 = grade-level, 3 = application, 4 = extension. */
export type Difficulty = 1 | 2 | 3 | 4;
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: 'Warm-up', 2: 'Core', 3: 'Apply', 4: 'Stretch' };

/** Recognition questions show the answer among options; application questions make the student produce it. */
export type Cognitive = 'recognition' | 'application' | 'reasoning';

export interface RubricCriterion {
  id: string;
  /** e.g. "Knowledge and understanding". */
  label: string;
  /** What a strong answer does. */
  description: string;
  levels: string[];
}

/** A wrong answer we can recognise, and what it usually means. */
export interface KnownWrong {
  value: string;
  misconception: string;
}

interface QuestionBase {
  id: string;
  expectationId: string;
  /** The skill this was generated from, when it came from an authored pack. */
  skillId: string | null;
  difficulty: Difficulty;
  cognitive: Cognitive;
  prompt: Block[];
  hints: string[];
  /** Full worked solution shown after answering. */
  solution: Block[];
  /** Where the question came from; AI questions are never presented as checked. */
  origin: 'authored' | 'generated' | 'ai' | 'ministry';
  /** True when the answer key was computed or checked by code, not just written by someone. */
  keyVerified: boolean;
  knownWrong?: KnownWrong[];
  /** Generator inputs, kept so the answer can be recomputed independently. */
  params?: Record<string, unknown>;
  /** Source passage for source-analysis questions (history, geography, English). */
  source?: { title: string; text: string; citation: string; kind: 'primary' | 'secondary' | 'ministry' } | null;
}

export type Question = QuestionBase &
  (
    | { type: 'multiple_choice'; choices: { id: string; text: string }[]; answer: string }
    | { type: 'multiple_select'; choices: { id: string; text: string }[]; answers: string[] }
    | { type: 'true_false'; answer: boolean }
    | { type: 'numeric'; answer: string; tolerance?: string | null; unit?: string | null; accept?: ('integer' | 'fraction' | 'mixed' | 'decimal' | 'percent')[]; requireSimplest?: boolean }
    | { type: 'expression'; answer: string; requireSimplified?: boolean; variables: string[] }
    | { type: 'short_answer'; accepted: string[]; keywords?: string[] }
    | { type: 'fill_blank'; template: string; blanks: { accepted: string[]; numeric?: boolean }[] }
    | { type: 'matching'; left: { id: string; text: string }[]; right: { id: string; text: string }[]; pairs: Record<string, string> }
    | { type: 'ordering'; items: { id: string; text: string }[]; order: string[] }
    | { type: 'written'; rubric: RubricCriterion[]; sampleAnswer: string | null; minWords?: number }
    | { type: 'code_trace'; code: string; answer: string }
  );

export type Response =
  | { type: 'choice'; choice: string }
  | { type: 'choices'; choices: string[] }
  | { type: 'bool'; value: boolean }
  | { type: 'text'; text: string }
  | { type: 'blanks'; values: string[] }
  | { type: 'pairs'; pairs: Record<string, string> }
  | { type: 'order'; order: string[] }
  | { type: 'written'; text: string; selfScores?: Record<string, number> };

export interface CheckResult {
  /** null when nobody (no code) can mark this answer — e.g. written answers without an AI review. */
  correct: boolean | null;
  /** 0..1 */
  score: number;
  feedback: string;
  misconception: string | null;
  /** Shown when the answer could not be read (e.g. "3/0"), so it is not counted as wrong. */
  unreadable?: string;
  /** How it was marked. */
  method: 'exact' | 'equivalent' | 'tolerance' | 'keywords' | 'self' | 'ai' | 'none';
}

// ─────────── Misconceptions ───────────

export interface Misconception {
  id: string;
  label: string;
  /** Why the mistake happens, in student-friendly words. */
  explanation: string;
  /** What to do instead. */
  fix: string;
}

// ─────────── Lessons ───────────

export const LESSON_MODES = ['full', 'short', 'timed', 'practice', 'revision', 'concept', 'challenge', 'mistakes'] as const;
export type LessonMode = (typeof LESSON_MODES)[number];
export const LESSON_MODE_LABEL: Record<LessonMode, string> = {
  full: 'Complete lesson',
  short: 'Short explanation',
  timed: 'Timed study session',
  practice: 'Practice only',
  revision: 'Revision before a test',
  concept: 'Help with one concept',
  challenge: 'Challenge activity',
  mistakes: 'Review my mistakes',
};

export const STEP_KINDS = ['objective', 'prerequisites', 'explain', 'worked_example', 'guided', 'independent', 'check', 'summary', 'next'] as const;
export type StepKind = (typeof STEP_KINDS)[number];
export const STEP_LABEL: Record<StepKind, string> = {
  objective: 'Learning goal',
  prerequisites: 'What you already know',
  explain: 'Explanation',
  worked_example: 'Worked example',
  guided: 'Try it together',
  independent: 'Your turn',
  check: 'Quick check',
  summary: 'Key ideas',
  next: 'What next',
};

export const ALT_EXPLANATIONS = ['simpler', 'analogy', 'steps', 'visual', 'compare', 'example'] as const;
export type AltExplanation = (typeof ALT_EXPLANATIONS)[number];
export const ALT_LABEL: Record<AltExplanation, string> = {
  simpler: 'Say it more simply',
  analogy: 'Use a real-world comparison',
  steps: 'Show me step by step',
  visual: 'Show me a picture',
  compare: 'Compare with something I know',
  example: 'Give me another example',
};

export interface LessonStep {
  kind: StepKind;
  title: string;
  blocks: Block[];
  /** Questions answered in this step. */
  questionIds: string[];
  /** How many questions this step should have; they are generated when the step opens, at the current difficulty. */
  planned?: number;
  /** For prerequisite checks: which expectation the warm-up questions come from. */
  forExpectationId?: string | null;
}

export interface LessonContent {
  title: string;
  expectationId: string;
  skillId: string | null;
  source: 'authored' | 'ai' | 'ministry';
  /** Explanation of where the content came from, shown on the lesson. */
  provenance: string;
  /** Student-friendly goal, written by FlowCompanion (not Ministry text). */
  goal: string;
  steps: LessonStep[];
  alternatives: Partial<Record<AltExplanation, Block[]>>;
  questions: Question[];
  summary: string[];
}

export type LessonStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface AnswerRecord {
  questionId: string;
  response: Response;
  result: CheckResult;
  hintsUsed: number;
  attempts: number;
  at: string;
  /** Time on the question in seconds, when measured. */
  seconds: number | null;
}

export interface LessonSession {
  id: string;
  expectationId: string;
  mode: LessonMode;
  minutes: number | null;
  status: LessonStatus;
  stepIndex: number;
  content: LessonContent;
  answers: Record<string, AnswerRecord>;
  /** Hints revealed per question. */
  hints: Record<string, number>;
  /** Mastery status for the expectation when the lesson started. */
  masteryBefore: MasteryStatus;
  /** Explanations the student asked for, in order. */
  alternativesShown: AltExplanation[];
  /** Difficulty currently used for new questions. */
  difficulty: Difficulty;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  outcome: LessonOutcome | null;
}

export interface LessonOutcome {
  correct: number;
  answered: number;
  independentCorrect: number;
  hintsUsed: number;
  masteryBefore: MasteryStatus;
  masteryAfter: MasteryStatus;
  recommendation: Recommendation;
}

export interface LessonSummary {
  id: string;
  expectationId: string;
  title: string;
  mode: LessonMode;
  status: LessonStatus;
  stepIndex: number;
  steps: number;
  source: LessonContent['source'];
  updatedAt: string;
  completedAt: string | null;
}

// ─────────── Mastery ───────────

export const MASTERY_STATUSES = ['not_assessed', 'not_yet', 'in_progress', 'developing', 'proficient', 'extension_ready', 'review'] as const;
export type MasteryStatus = (typeof MASTERY_STATUSES)[number];
export const MASTERY_LABEL: Record<MasteryStatus, string> = {
  not_assessed: 'Not assessed',
  not_yet: 'Not yet demonstrated',
  in_progress: 'Learning in progress',
  developing: 'Developing',
  proficient: 'Proficient for this goal',
  extension_ready: 'Ready for extension',
  review: 'Review recommended',
};

export interface Evidence {
  at: string;
  correct: boolean;
  score: number;
  difficulty: Difficulty;
  cognitive: Cognitive;
  hinted: boolean;
  /** How much this answer can be trusted as evidence (1 = checked by code, 0.5 = AI-marked, 0.25 = AI key not checked). */
  weight: number;
  source: 'lesson' | 'quiz' | 'review' | 'assessment' | 'diagnostic';
  misconception: string | null;
}

export interface MasteryRecord {
  expectationId: string;
  status: MasteryStatus;
  /** 0..1, a weighted share of recent evidence. Not a probability and not an Ontario achievement level. */
  estimate: number;
  evidenceCount: number;
  independentCorrect: number;
  assistedCorrect: number;
  incorrect: number;
  lastPracticedAt: string | null;
  lastIndependentSuccessAt: string | null;
  nextReviewAt: string | null;
  reviewIntervalDays: number;
  misconceptions: Record<string, number>;
  /** Plain-language reasons for the status. */
  reasons: string[];
  updatedAt: string;
}

export type GapKind = 'repeated_error' | 'prerequisite' | 'recognition_not_application' | 'hint_dependence' | 'decay';
export const GAP_LABEL: Record<GapKind, string> = {
  repeated_error: 'Same mistake more than once',
  prerequisite: 'An earlier skill needs work',
  recognition_not_application: 'Recognizes answers but finds it hard to produce them',
  hint_dependence: 'Gets there with hints, less often without',
  decay: 'Has not been practised for a while',
};

export interface Gap {
  kind: GapKind;
  expectationId: string;
  detail: string;
  misconception: string | null;
  relatedExpectationId: string | null;
}

export type RecommendationKind = 'review_prerequisite' | 'more_practice' | 'retry_lesson' | 'move_on' | 'extension' | 'spaced_review' | 'start';
export interface Recommendation {
  kind: RecommendationKind;
  expectationId: string;
  title: string;
  reason: string;
}

// ─────────── Quizzes ───────────

export const QUIZ_KINDS = ['practice', 'pop', 'diagnostic', 'formative', 'unit_review', 'summative_practice', 'reflection'] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];
export const QUIZ_KIND_LABEL: Record<QuizKind, string> = {
  practice: 'Practice',
  pop: 'Pop quiz',
  diagnostic: 'Diagnostic check',
  formative: 'Formative check',
  unit_review: 'Unit review',
  summative_practice: 'Practice test',
  reflection: 'Self-reflection',
};
/** What the student is told before starting. */
export const QUIZ_KIND_RULES: Record<QuizKind, string> = {
  practice: 'Hints and feedback after every question. Nothing here is a mark.',
  pop: 'A short check. Feedback after every question; hints are available but noted.',
  diagnostic: 'Finds out what you already know so lessons start in the right place. No hints; feedback at the end.',
  formative: 'Checks how the learning is going. Feedback after every question.',
  unit_review: 'Mixed questions from a unit. Hints are available but noted.',
  summative_practice: 'Practice test: no hints and feedback at the end, like a test. It is practice, not an official test.',
  reflection: 'Your own view of how confident you feel. It is not marked.',
};

export interface QuizSettings {
  length: number;
  timed: boolean;
  minutes: number | null;
  hints: boolean;
  feedback: 'immediate' | 'end';
  adaptive: boolean;
}

export interface QuizItem {
  id: string;
  position: number;
  question: Question;
  answer: AnswerRecord | null;
}

export interface QuizAttempt {
  id: string;
  kind: QuizKind;
  title: string;
  expectationIds: string[];
  settings: QuizSettings;
  status: 'active' | 'completed' | 'abandoned';
  items: QuizItem[];
  startedAt: string;
  finishedAt: string | null;
  deadlineAt: string | null;
  score: number | null;
  maxScore: number | null;
  /** True when any question's answer key was written by AI and not checked by code. */
  hasUnverifiedKeys: boolean;
  assessmentId: string | null;
  /** Hints revealed per item. */
  hints: Record<string, number>;
  /** Expectations left out because there are no questions for them offline (and AI was not used). */
  skipped: string[];
}

export interface QuizSummary {
  id: string;
  kind: QuizKind;
  title: string;
  status: QuizAttempt['status'];
  questions: number;
  answered: number;
  correct: number;
  score: number | null;
  maxScore: number | null;
  startedAt: string;
  finishedAt: string | null;
  hintsUsed: number;
}

// ─────────── Student profiles ───────────

export const GOAL_KINDS = ['improve_math', 'understand_science', 'stronger_writing', 'test_prep', 'catch_up', 'get_ahead', 'homework_help', 'other'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const GOAL_LABEL: Record<GoalKind, string> = {
  improve_math: 'Get better at math',
  understand_science: 'Understand science',
  stronger_writing: 'Write more clearly',
  test_prep: 'Prepare for a test',
  catch_up: 'Catch up on things I missed',
  get_ahead: 'Get ahead',
  homework_help: 'Help with homework',
  other: 'Something else',
};

export const EXPLANATION_STYLES = ['step_by_step', 'examples_first', 'big_picture', 'visual', 'short'] as const;
export type ExplanationStyle = (typeof EXPLANATION_STYLES)[number];
export const EXPLANATION_STYLE_LABEL: Record<ExplanationStyle, string> = {
  step_by_step: 'Step by step',
  examples_first: 'Examples first',
  big_picture: 'Big picture first',
  visual: 'Pictures and diagrams when possible',
  short: 'Short and to the point',
};

export interface StudentAccessibility {
  /** Multiplies the app's text size inside Student Learning. */
  textScale: number;
  readableFont: boolean;
  /** Plainer wording in lessons and feedback. */
  simplifiedLanguage: boolean;
  /** Timed activities get 50% more time. */
  extraTime: boolean;
  reduceMotion: boolean;
}

export interface ParentSharing {
  enabled: boolean;
  goals: boolean;
  activities: boolean;
  progress: boolean;
}

export interface StudentProfile {
  id: string;
  displayName: string;
  grade: Grade;
  courseIds: string[];
  goalKinds: GoalKind[];
  goals: string[];
  explanationStyle: ExplanationStyle;
  /** Self-reported, 1–5, per course. Shown back to the student but never used as proof of knowledge. */
  confidence: Record<string, number>;
  studyDays: Weekday[];
  dailyMinutes: number;
  sessionMinutes: 5 | 10 | 20 | 30;
  studyTime: string;
  accessibility: StudentAccessibility;
  /** Whether lessons and tutoring may use the connected AI provider. */
  aiTutoring: boolean;
  /** Whether a short summary of verified progress may be included in AI requests. */
  shareProgressWithAi: boolean;
  parentSharing: ParentSharing;
  autoSchedule: boolean;
  hasPin: boolean;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentListItem {
  id: string;
  displayName: string;
  grade: Grade;
  hasPin: boolean;
  active: boolean;
}

// ─────────── Plans and assignments ───────────

export const ASSIGNMENT_KINDS = ['assignment', 'test', 'project', 'exam', 'essay', 'lab', 'presentation'] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

export interface AssignmentStep {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  /** Suggested activity, if any. */
  activity: { kind: 'lesson' | 'quiz' | 'review' | 'write' | 'research' | 'diagnostic'; expectationIds: string[] } | null;
}

export interface Assignment {
  id: string;
  title: string;
  kind: AssignmentKind;
  courseId: string | null;
  expectationIds: string[];
  dueAt: string | null;
  /** The task description as the student entered it. Treated as untrusted text. */
  prompt: string;
  status: 'open' | 'done';
  steps: AssignmentStep[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PlanActivityKind = 'diagnostic' | 'prerequisite_review' | 'lesson' | 'guided_practice' | 'independent_practice' | 'mixed_quiz' | 'mistakes_review' | 'spaced_review';
export const PLAN_ACTIVITY_LABEL: Record<PlanActivityKind, string> = {
  diagnostic: 'Short diagnostic quiz',
  prerequisite_review: 'Review earlier skills',
  lesson: 'Lesson',
  guided_practice: 'Guided practice',
  independent_practice: 'Independent practice',
  mixed_quiz: 'Mixed practice quiz',
  mistakes_review: 'Review recurring mistakes',
  spaced_review: 'Spaced review',
};

export interface PlanSession {
  id: string;
  date: string;
  start: string;
  minutes: number;
  activity: PlanActivityKind;
  expectationIds: string[];
  title: string;
  reason: string;
  status: 'planned' | 'done' | 'missed' | 'skipped';
  eventId: string | null;
  taskId: string | null;
}

export interface StudyPlan {
  id: string;
  title: string;
  goal: string;
  kind: 'test_prep' | 'weekly' | 'daily_review' | 'assignment';
  assignmentId: string | null;
  status: 'proposed' | 'approved' | 'completed' | 'archived';
  sessions: PlanSession[];
  createdAt: string;
  approvedAt: string | null;
  timeZone: string;
}

// ─────────── Assessments ───────────

export interface AssessmentItem {
  id: string;
  question: Question;
  points: number;
  reviewed: boolean;
}

export interface Assessment {
  id: string;
  title: string;
  grade: Grade | null;
  courseId: string | null;
  expectationIds: string[];
  format: 'quiz' | 'test' | 'assignment';
  difficulty: Difficulty | 'mixed';
  questionTypes: QuestionType[];
  timeLimitMinutes: number | null;
  items: AssessmentItem[];
  rubric: RubricCriterion[];
  instructions: string;
  status: 'draft' | 'reviewed';
  origin: 'generated' | 'ai' | 'mixed' | 'manual';
  createdAt: string;
  updatedAt: string;
}

// ─────────── Tutor ───────────

export interface TutorSession {
  id: string;
  title: string;
  courseId: string | null;
  expectationId: string | null;
  style: ExplanationStyle;
  createdAt: string;
  updatedAt: string;
}

export interface TutorMessage {
  id: string;
  sessionId: string;
  role: 'student' | 'tutor';
  content: string;
  status: 'complete' | 'streaming' | 'error';
  error: string | null;
  createdAt: string;
  /** For tutor replies: which provider and model answered. */
  model: string | null;
}

// ─────────── Reports ───────────

export interface ProgressReport {
  generatedAt: string;
  student: { displayName: string; grade: Grade };
  audience: 'student' | 'parent';
  /** What this report leaves out, in plain words. */
  privacyNote: string;
  goals: string[] | null;
  activities: { lessonsCompleted: number; quizzesCompleted: number; questionsAnswered: number; minutesStudied: number; recent: { at: string; what: string }[] } | null;
  progress: { courseId: string; course: string; expectations: number; byStatus: Record<MasteryStatus, number>; strengths: string[]; needsPractice: string[] }[] | null;
  disclaimer: string;
}

export interface ContentReport {
  id: string;
  kind: 'inaccurate' | 'inappropriate' | 'unclear' | 'curriculum_mismatch' | 'other';
  target: string;
  detail: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

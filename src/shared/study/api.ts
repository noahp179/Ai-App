import type { SaveResult } from '../api';
import type { CourseDetail, CourseSummary, CoverageReport, CurriculumImport, CurriculumOverview, CurriculumSearchHit, CurriculumUpdateCheck, ExpectationDetail, RevisionEntry } from '../curriculum/views';
import type {
  AltExplanation,
  Assessment,
  Assignment,
  Block,
  CheckResult,
  ContentReport,
  Difficulty,
  Gap,
  LessonMode,
  LessonSession,
  LessonSummary,
  MasteryRecord,
  MasteryStatus,
  Misconception,
  PlanSession,
  ProgressReport,
  QuestionType,
  QuizAttempt,
  QuizKind,
  QuizSummary,
  Recommendation,
  Response,
  StudentListItem,
  StudentProfile,
  StudyPlan,
  TutorMessage,
  TutorSession,
} from './types';

/** The official curriculum store (shared by everyone on this computer; contains no personal data). */
export interface CurriculumApi {
  overview(): CurriculumOverview;
  courses(query?: { grade?: number | null; documentId?: string | null; search?: string | null }): CourseSummary[];
  course(id: string): CourseDetail;
  expectation(id: string): ExpectationDetail;
  search(q: string, opts?: { grade?: number | null; limit?: number }): CurriculumSearchHit[];
  imports(): CurriculumImport[];
  revisions(): (RevisionEntry & { recordId: string; recordType: string })[];
  /** Downloads the curriculum from the Ministry site and compares it; nothing changes until applyUpdate. */
  checkForUpdates(): Promise<CurriculumUpdateCheck>;
  pendingUpdate(): CurriculumUpdateCheck | null;
  applyUpdate(): CurriculumImport;
  /** Imports a curriculum file; its records are always marked unverified. Null if the dialog was cancelled. */
  importFile(): Promise<CurriculumImport | null>;
  coverage(): CoverageReport;
  exportCoverage(): Promise<SaveResult>;
}

export interface LessonAnswer {
  result: CheckResult;
  answer: string;
  solution: Block[];
  misconception: Misconception | null;
  difficulty: Difficulty;
  adaptReason: string;
  session: LessonSession;
}

export interface QuizAnswer {
  result: CheckResult | null;
  answer: string | null;
  solution: Block[] | null;
  misconception: Misconception | null;
  adaptReason: string | null;
  attempt: QuizAttempt;
}

export interface CourseProgressRow {
  expectationId: string;
  index: string;
  strand: string;
  status: MasteryStatus;
  estimate: number | null;
  offline: boolean;
  supports: boolean;
}

export interface StudyDashboard {
  profile: StudentProfile;
  continueLessons: LessonSummary[];
  recentLessons: LessonSummary[];
  upcoming: (PlanSession & { planId: string; planTitle: string })[];
  plansWithMissed: string[];
  reviewsDue: number;
  gaps: Gap[];
  recommendations: Recommendation[];
  mastered: string[];
  needsPractice: string[];
  byStatus: Record<MasteryStatus, number>;
  recentQuizzes: QuizSummary[];
  assignments: Assignment[];
  ai: StudyAiStatus;
}

export interface StudyAiStatus {
  available: boolean;
  reason: string | null;
  studentAllows: boolean | null;
}

export interface ExpectationProgress {
  record: MasteryRecord;
  recommendation: Recommendation;
  sources: { authored: boolean; ministry: boolean; ai: { ok: boolean; reason: string | null } };
  gaps: Gap[];
  showEstimates: boolean;
  prerequisites: string[];
}

export interface AssessmentBuildInput {
  title: string;
  expectationIds: string[];
  format?: 'quiz' | 'test' | 'assignment';
  questionCount?: number;
  difficulty?: Difficulty | 'mixed';
  questionTypes?: QuestionType[];
  timeLimitMinutes?: number | null;
  includeWritten?: boolean;
  useAi?: boolean;
  instructions?: string;
}

/** Student Learning. Calls about a student's records always act on the open profile. */
export interface StudyApi {
  profiles(): StudentListItem[];
  createProfile(input: Partial<StudentProfile>, pin?: string | null): StudentProfile;
  openProfile(id: string, pin?: string | null): StudentProfile;
  closeProfile(): void;
  me(): StudentProfile | null;
  updateProfile(patch: Partial<StudentProfile>): StudentProfile;
  setPin(currentPin: string | null, newPin: string | null): void;
  deleteProfile(confirmName: string): void;
  parentResetPin(studentId: string, parentPin: string): void;
  parentReport(studentId: string, parentPin: string): ProgressReport;
  exportParentReport(studentId: string, parentPin: string): Promise<SaveResult>;

  dashboard(): StudyDashboard;
  aiStatus(): StudyAiStatus;
  courseProgress(courseId: string): { detail: CourseDetail; rows: CourseProgressRow[] };
  expectationProgress(expectationId: string): ExpectationProgress;

  startLesson(input: { expectationId: string; mode: LessonMode; minutes?: number | null; source?: 'auto' | 'authored' | 'ministry' | 'ai' }): Promise<LessonSession>;
  lesson(id: string): LessonSession;
  lessons(status?: 'open' | 'completed' | 'all'): LessonSummary[];
  goToStep(id: string, step: number): LessonSession;
  pauseLesson(id: string): LessonSession;
  resumeLesson(id: string): LessonSession;
  repeatLesson(id: string): Promise<LessonSession>;
  abandonLesson(id: string): void;
  lessonHint(id: string, questionId: string): { hint: string | null; used: number; total: number };
  answerLesson(id: string, questionId: string, response: Response, opts?: { seconds?: number | null; aiFeedback?: boolean }): Promise<LessonAnswer>;
  similarQuestion(id: string, questionId: string): LessonSession;
  explainAgain(id: string, kind: AltExplanation): Promise<{ blocks: Block[]; source: 'authored' | 'ai'; label: string }>;
  completeLesson(id: string): LessonSession;

  createQuiz(input: { kind: QuizKind; expectationIds: string[]; length?: number; timed?: boolean; minutes?: number | null; useAi?: boolean }): Promise<QuizAttempt>;
  quiz(id: string): QuizAttempt;
  quizzes(): QuizSummary[];
  quizHint(id: string, itemId: string): { hint: string | null; used: number; total: number };
  answerQuiz(id: string, itemId: string, response: Response, opts?: { seconds?: number | null; aiFeedback?: boolean }): Promise<QuizAnswer>;
  finishQuiz(id: string): QuizAttempt;
  abandonQuiz(id: string): void;

  reviewQueue(): MasteryRecord[];
  startReview(expectationIds?: string[]): Promise<QuizAttempt>;
  gaps(): Gap[];
  mastery(): MasteryRecord[];
  reflect(input: { expectationId?: string | null; courseId?: string | null; confidence: number; note?: string }): void;
  activity(limit?: number): { at: string; kind: string; detail: string; expectationId: string | null; seconds: number }[];

  plans(): StudyPlan[];
  proposePlan(input: { kind: StudyPlan['kind']; expectationIds: string[]; dueDate?: string | null; goal?: string; assignmentId?: string | null }): StudyPlan;
  approvePlan(id: string): StudyPlan;
  discardPlan(id: string): void;
  reschedulePlan(id: string): { plan: StudyPlan; moved: number; dropped: number };
  markPlanSession(id: string, sessionId: string, status: 'done' | 'skipped' | 'planned'): StudyPlan;
  archivePlan(id: string, removeFuture: boolean): StudyPlan;

  assignments(includeDone?: boolean): Assignment[];
  createAssignment(input: Partial<Assignment>): Assignment;
  updateAssignment(id: string, patch: Partial<Assignment>): Assignment;
  toggleAssignmentStep(id: string, stepId: string, done: boolean): Assignment;
  deleteAssignment(id: string): void;
  draftFeedback(id: string, draft: string): Promise<string>;

  assessments(): Assessment[];
  assessment(id: string): Assessment;
  buildAssessment(input: AssessmentBuildInput, shared?: boolean): Promise<{ assessment: Assessment; skipped: string[] }>;
  reviewAssessmentItem(id: string, itemId: string, reviewed: boolean): Assessment;
  markAssessmentReviewed(id: string): Assessment;
  removeAssessmentItem(id: string, itemId: string): Assessment;
  regenerateAssessmentItem(id: string, itemId: string): Assessment;
  updateAssessment(id: string, patch: { title?: string; instructions?: string; timeLimitMinutes?: number | null }): Assessment;
  duplicateAssessment(id: string): Assessment;
  deleteAssessment(id: string): void;
  exportAssessment(id: string, format: 'markdown' | 'json'): Promise<SaveResult>;
  takeAssessment(id: string): Promise<QuizAttempt>;

  tutorSessions(): TutorSession[];
  createTutorSession(input: { courseId?: string | null; expectationId?: string | null; title?: string }): TutorSession;
  updateTutorSession(id: string, patch: { expectationId?: string | null; style?: TutorSession['style']; title?: string }): TutorSession;
  tutorMessages(id: string): TutorMessage[];
  sendTutor(id: string, text: string): { studentMessage: TutorMessage; tutorMessage: TutorMessage };
  stopTutor(id: string): boolean;
  resetTutor(id: string): void;
  deleteTutorSession(id: string): void;

  myReport(): ProgressReport;
  exportMyReport(): Promise<SaveResult>;
  exportMyData(): Promise<SaveResult>;
  deleteMyLearningData(confirm: string): number;
  reportContent(input: { kind: ContentReport['kind']; target: string; detail: string }): ContentReport;
  contentReports(): ContentReport[];
  resolveContentReport(id: string): void;
}

export interface TutorStreamEvent {
  sessionId: string;
  messageId: string;
  kind: 'delta' | 'done' | 'error';
  delta?: string;
  error?: string;
}

/**
 * Domain types shared by the main process, the preload bridge and the UI.
 * Timestamps are ISO-8601 strings in UTC unless a field says otherwise.
 */

export type Id = string;
export type IsoTime = string;

// ───────────────────────────── App ─────────────────────────────

export interface AppInfo {
  name: string;
  version: string;
  platform: 'darwin' | 'win32' | 'linux' | string;
  arch: string;
  electron: string;
  chrome: string;
  node: string;
  sqlite: string;
  dataDir: string;
  dbPath: string;
  isPackaged: boolean;
  systemTimeZone: string;
}

export interface Capabilities {
  /** OS-backed secret encryption (Keychain, DPAPI, libsecret/kwallet). */
  secureStorage: { available: boolean; backend: string; detail: string };
  notifications: { supported: boolean; detail: string };
  tray: { supported: boolean; detail: string };
  contentProtection: { supported: boolean; detail: string };
  windowOpacity: { supported: boolean; detail: string };
  launchAtLogin: { supported: boolean; detail: string };
  globalShortcuts: { supported: boolean; detail: string };
}

export interface StartupReport {
  migratedFrom: number;
  migratedTo: number;
  backupPath: string | null;
  recoveredFromCorruption: boolean;
  recoveryDetail: string | null;
  draftsToRecover: number;
}

// ───────────────────────────── Notes ─────────────────────────────

export type NoteFormat = 'markdown' | 'plain';

export interface Folder {
  id: Id;
  name: string;
  parentId: Id | null;
  createdAt: IsoTime;
  updatedAt: IsoTime;
}

export interface NoteSummary {
  id: Id;
  title: string;
  excerpt: string;
  format: NoteFormat;
  folderId: Id | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  archivedAt: IsoTime | null;
  deletedAt: IsoTime | null;
  createdAt: IsoTime;
  updatedAt: IsoTime;
  revision: number;
}

export interface Note extends NoteSummary {
  body: string;
}

export type NoteView = 'all' | 'pinned' | 'favorites' | 'archived' | 'trash';

export interface NoteQuery {
  view?: NoteView;
  folderId?: Id | null;
  tag?: string;
  search?: string;
  sort?: 'updated' | 'created' | 'title';
}

export interface NoteDraft {
  noteId: Id;
  title: string;
  body: string;
  baseRevision: number;
  savedAt: IsoTime;
}

export type LinkableType = 'note' | 'task' | 'prompt' | 'event' | 'conversation' | 'bookmark' | 'resource';

export interface EntityLink {
  id: Id;
  fromType: LinkableType;
  fromId: Id;
  toType: LinkableType;
  toId: Id;
  createdAt: IsoTime;
  /** Resolved title of the "other" side, for display. Null if it was deleted. */
  title?: string | null;
}

// ───────────────────────────── Tasks & productivity ─────────────────────────────

export type TaskPriority = 0 | 1 | 2 | 3; // none, low, medium, high

export interface TaskList {
  id: Id;
  name: string;
  createdAt: IsoTime;
  openCount?: number;
}

export interface Task {
  id: Id;
  listId: Id | null;
  parentId: Id | null;
  title: string;
  notes: string;
  done: boolean;
  priority: TaskPriority;
  dueAt: IsoTime | null;
  completedAt: IsoTime | null;
  sortOrder: number;
  createdAt: IsoTime;
  updatedAt: IsoTime;
  subtasks?: Task[];
}

export interface TaskQuery {
  listId?: Id | null | 'all' | 'today' | 'upcoming' | 'inbox';
  includeDone?: boolean;
  search?: string;
}

export interface Bookmark {
  id: Id;
  url: string;
  title: string;
  description: string;
  tags: string[];
  queue: 'none' | 'unread' | 'read';
  createdAt: IsoTime;
  updatedAt: IsoTime;
  readAt: IsoTime | null;
}

export interface TimeEntry {
  id: Id;
  label: string;
  taskId: Id | null;
  startedAt: IsoTime;
  endedAt: IsoTime | null;
  createdAt: IsoTime;
}

export interface FocusSession {
  id: Id;
  kind: 'focus' | 'short_break' | 'long_break';
  plannedMinutes: number;
  startedAt: IsoTime;
  endsAt: IsoTime;
  pausedAt: IsoTime | null;
  remainingMs: number | null;
  endedAt: IsoTime | null;
  completed: boolean;
  label: string;
}

export interface FocusStats {
  todayFocusMinutes: number;
  todaySessions: number;
  weekFocusMinutes: number;
  streakDays: number;
}

export type CaptureKind = 'note' | 'task' | 'bookmark' | 'reading' | 'event';
export interface CaptureResult {
  kind: CaptureKind;
  id: Id;
  title: string;
}

// ───────────────────────────── Search ─────────────────────────────

export interface SearchHit {
  type: 'note' | 'task' | 'prompt' | 'conversation' | 'event' | 'bookmark' | 'resource' | 'article';
  id: Id;
  title: string;
  snippet: string;
  updatedAt: IsoTime | null;
}

// ───────────────────────────── AI ─────────────────────────────

export type ProviderKind = 'openai' | 'openai_compatible' | 'anthropic' | 'gemini' | 'ollama';

export interface ProviderCapabilities {
  streaming: boolean;
  systemPrompt: boolean;
  listModels: boolean;
  local: boolean;
  requiresApiKey: boolean;
}

export interface ProviderConfig {
  id: Id;
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  defaultModel: string | null;
  enabled: boolean;
  hasApiKey: boolean;
  /** Where the key lives: OS secure storage, memory only for this session, or nowhere. */
  keyStorage: 'secure' | 'session' | 'none';
  createdAt: IsoTime;
  updatedAt: IsoTime;
  lastStatus: ProviderStatus | null;
}

export interface ProviderStatus {
  ok: boolean;
  checkedAt: IsoTime;
  message: string;
  models: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow?: number | null;
}

export type AiErrorCode =
  | 'not_configured'
  | 'auth'
  | 'rate_limit'
  | 'model_not_found'
  | 'context_length'
  | 'bad_request'
  | 'network'
  | 'timeout'
  | 'canceled'
  | 'server'
  | 'refused'
  | 'unknown';

export interface AiErrorInfo {
  code: AiErrorCode;
  message: string;
  status?: number;
  retryAfterSeconds?: number;
}

export interface Conversation {
  id: Id;
  title: string;
  providerId: Id | null;
  model: string | null;
  systemPrompt: string;
  archivedAt: IsoTime | null;
  ephemeral: boolean;
  createdAt: IsoTime;
  updatedAt: IsoTime;
  messageCount?: number;
  lastMessagePreview?: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'complete' | 'streaming' | 'error' | 'canceled';

export interface Message {
  id: Id;
  conversationId: Id;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  error: AiErrorInfo | null;
  providerId: Id | null;
  providerKind: ProviderKind | null;
  model: string | null;
  usage: { inputTokens?: number; outputTokens?: number } | null;
  /** The model that actually answered, when the provider reports it (can differ after a fallback). */
  servedModel: string | null;
  /** Notes about this response: fallbacks, truncation, recovered errors. */
  notices: string[];
  createdAt: IsoTime;
  finishedAt: IsoTime | null;
}

export interface SendMessageInput {
  conversationId: Id;
  content: string;
  providerId?: Id | null;
  model?: string | null;
  /** Explicitly attached context. The user confirmed sending it. */
  attachments?: { type: 'note' | 'event' | 'task'; id: Id }[];
}

export interface AiStreamEvent {
  conversationId: Id;
  messageId: Id;
  kind: 'delta' | 'done' | 'error' | 'canceled';
  delta?: string;
  error?: AiErrorInfo;
}

// ───────────────────────────── AI task status ─────────────────────────────

export type AiTaskState = 'idle' | 'running' | 'waiting_input' | 'completed' | 'failed' | 'canceled' | 'unknown';
/** How we know the state: confirmed by an API/integration, estimated by a timer, or set by the user. */
export type AiTaskConfidence = 'confirmed' | 'estimated' | 'manual';
export type AiTaskSource = 'native' | 'browser' | 'timer' | 'manual';

export interface AiTask {
  id: Id;
  title: string;
  source: AiTaskSource;
  state: AiTaskState;
  confidence: AiTaskConfidence;
  refType: 'conversation' | 'url' | null;
  refId: string | null;
  startedAt: IsoTime;
  updatedAt: IsoTime;
  finishedAt: IsoTime | null;
  timeoutAt: IsoTime | null;
  notifiedAt: IsoTime | null;
  detail: string;
}

// ───────────────────────────── Calendar ─────────────────────────────

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: Monday = 1

export interface RecurrenceRule {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  byWeekday?: Weekday[];
  /** Monthly: on the Nth weekday (1..4, or -1 for last). Requires byWeekday with one entry. */
  bySetPos?: number;
  count?: number;
  /** Inclusive end date, local to the event (YYYY-MM-DD). */
  until?: string;
}

export interface EventOverride {
  /** Original occurrence start, in the event's local wall time (YYYY-MM-DDTHH:mm or YYYY-MM-DD). */
  originalStart: string;
  cancelled?: boolean;
  title?: string;
  start?: string;
  end?: string;
  location?: string;
  notes?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CalendarEvent {
  id: Id;
  title: string;
  notes: string;
  location: string;
  meetingUrl: string;
  category: string;
  allDay: boolean;
  /** Wall time in `timeZone`: YYYY-MM-DDTHH:mm, or YYYY-MM-DD when allDay. */
  start: string;
  end: string;
  /** IANA zone the wall times are expressed in. Ignored for all-day events. */
  timeZone: string;
  recurrence: RecurrenceRule | null;
  overrides: EventOverride[];
  checklist: ChecklistItem[];
  /** Reminder offsets in minutes before start. */
  reminders: number[];
  source: 'local';
  createdAt: IsoTime;
  updatedAt: IsoTime;
}

export interface EventOccurrence {
  eventId: Id;
  /** Original occurrence key (wall time in the event zone). Used for overrides and reminder dedupe. */
  occurrenceKey: string;
  title: string;
  location: string;
  category: string;
  allDay: boolean;
  /** Absolute instants (UTC ISO). All-day occurrences span local midnight to midnight in the display zone. */
  startUtc: IsoTime;
  endUtc: IsoTime;
  /** For all-day events: the YYYY-MM-DD dates covered. */
  startDate?: string;
  endDate?: string;
  recurring: boolean;
  modified: boolean;
}

export interface ReminderRecord {
  id: Id;
  title: string;
  body: string;
  fireAt: IsoTime;
  /** Optional link to something the reminder is about. */
  refType: 'task' | 'resource' | 'note' | 'event' | null;
  refId: Id | null;
  snoozedUntil: IsoTime | null;
  completedAt: IsoTime | null;
  dismissedAt: IsoTime | null;
  createdAt: IsoTime;
}

export interface InboxNotification {
  id: Id;
  dedupeKey: string;
  kind: 'reminder' | 'event' | 'ai_task' | 'feed_alert' | 'trial' | 'system' | 'focus';
  title: string;
  body: string;
  createdAt: IsoTime;
  readAt: IsoTime | null;
  /** How it was delivered: OS banner, held silently because of quiet hours, or noticed late. */
  delivery: 'os' | 'quiet_hours' | 'missed' | 'in_app';
  action: { route: string; params?: Record<string, string> } | null;
  snoozable: boolean;
  sourceRef: string | null;
}

// ───────────────────────────── News ─────────────────────────────

export interface FeedSource {
  id: Id;
  name: string;
  url: string;
  siteUrl: string;
  category: string;
  enabled: boolean;
  blocked: boolean;
  builtin: boolean;
  lastFetchedAt: IsoTime | null;
  lastError: string | null;
  itemCount?: number;
}

export interface FeedItem {
  id: Id;
  sourceId: Id;
  sourceName: string;
  category: string;
  url: string;
  title: string;
  summary: string;
  author: string;
  publishedAt: IsoTime | null;
  fetchedAt: IsoTime;
  readAt: IsoTime | null;
  savedAt: IsoTime | null;
  duplicateOf: Id | null;
}

export interface FeedQuery {
  category?: string;
  sourceId?: Id;
  search?: string;
  savedOnly?: boolean;
  unreadOnly?: boolean;
  limit?: number;
}

export interface FeedRefreshResult {
  sourceId: Id;
  name: string;
  ok: boolean;
  newItems: number;
  error: string | null;
  notModified: boolean;
}

export interface FeedAlert {
  id: Id;
  keyword: string;
  enabled: boolean;
  createdAt: IsoTime;
}

// ───────────────────────────── Games ─────────────────────────────

export type GameId = 'wordguess' | 'sudoku' | 'memory' | 'reaction' | 'trivia';

export interface GameScore {
  id: Id;
  game: GameId;
  score: number;
  /** Lower is better for some games (reaction ms, sudoku seconds). */
  detail: Record<string, string | number | boolean>;
  playedAt: IsoTime;
}

export interface GameStats {
  game: GameId;
  played: number;
  best: GameScore | null;
  recent: GameScore[];
}

// ───────────────────────────── Learning ─────────────────────────────

export type ResourceType = 'article' | 'guide' | 'video' | 'course' | 'exercise' | 'documentation' | 'project' | 'book';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface LearningResource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  type: ResourceType;
  level: SkillLevel;
  topics: string[];
  summary: string;
  /** "none": no account needed. "optional": account unlocks extras like progress tracking. "required": must sign up. */
  registration: 'none' | 'optional' | 'required';
  /** Free to learn from. Paid extras are listed separately. */
  free: true;
  paidExtras: string | null;
  prerequisites: string[];
  accessibility: string | null;
  /** Date the link was last checked by scripts/verify-links.mjs, and the result. */
  linkCheck: { checkedOn: string; status: number | null; ok: boolean } | null;
}

export interface LearningPath {
  id: string;
  title: string;
  audience: string;
  description: string;
  steps: { resourceId: string; why: string }[];
}

export type ResourceStatus = 'not_started' | 'in_progress' | 'completed';

export interface ResourceProgress {
  resourceId: string;
  saved: boolean;
  status: ResourceStatus;
  notes: string;
  startedAt: IsoTime | null;
  completedAt: IsoTime | null;
  lastOpenedAt: IsoTime | null;
  updatedAt: IsoTime;
}

export type LearningResourceView = LearningResource & { progress: ResourceProgress | null };

export interface LearningPathView extends LearningPath {
  total: number;
  completed: number;
  started: boolean;
  nextResourceId: string | null;
}

export interface LearningRecommendation {
  resourceId: string;
  /** Plain-language reason shown next to the suggestion. */
  reason: string;
  pathId: string | null;
}

export interface LearningOverview {
  /** When scripts/verify-links.mjs last checked the bundled links. */
  checkedOn: string | null;
  total: number;
  verified: number;
  topics: { id: string; label: string; count: number }[];
  saved: number;
  inProgress: number;
  completed: number;
}

export interface LearningQuery {
  search?: string;
  topic?: string;
  level?: SkillLevel | 'any';
  type?: ResourceType | 'any';
  registration?: 'none' | 'optional' | 'required' | 'any';
  savedOnly?: boolean;
  status?: ResourceStatus | 'any';
}

// ───────────────────────────── Prompts ─────────────────────────────

export type ProviderLabel = 'any' | 'openai' | 'anthropic' | 'gemini' | 'local';

export interface Prompt {
  id: Id;
  title: string;
  description: string;
  body: string;
  category: string;
  tags: string[];
  favorite: boolean;
  providers: ProviderLabel[];
  version: number;
  origin: 'user' | 'marketplace';
  listingId: Id | null;
  createdAt: IsoTime;
  updatedAt: IsoTime;
  lastUsedAt: IsoTime | null;
  useCount: number;
}

export interface PromptVersion {
  id: Id;
  promptId: Id;
  version: number;
  title: string;
  body: string;
  note: string;
  createdAt: IsoTime;
}

export interface PromptVariable {
  name: string;
  defaultValue: string | null;
  required: boolean;
}

// ───────────────────────────── Marketplace ─────────────────────────────

export type ListingOrigin = 'bundled' | 'local' | 'remote';
export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'removed';

export interface CreatorProfile {
  id: Id;
  displayName: string;
  bio: string;
  website: string;
  isSelf: boolean;
  origin: ListingOrigin;
  createdAt: IsoTime;
  listingCount?: number;
}

export interface Listing {
  id: Id;
  origin: ListingOrigin;
  title: string;
  summary: string;
  /** Preview text that may be shown before access. */
  preview: string;
  /** Full prompt body. Null when the viewer does not have access (paid, no entitlement). */
  body: string | null;
  category: string;
  tags: string[];
  providers: ProviderLabel[];
  creatorId: Id;
  creatorName: string;
  pricing: { type: 'free' } | { type: 'paid'; priceCents: number; currency: string };
  trialEligible: boolean;
  version: string;
  status: ListingStatus;
  moderationNote: string | null;
  createdAt: IsoTime;
  updatedAt: IsoTime;
  publishedAt: IsoTime | null;
  rating: { average: number; count: number } | null;
  /** Clearly-labelled sample listing (e.g. seeded on the reference server). */
  demo: boolean;
  /** `${origin}:${id}` — unique across bundled, local and server listings. */
  key: string;
  /** Imported from a listing file; nobody has reviewed it. */
  imported: boolean;
  /** Created by you in Creator Studio. */
  isMine: boolean;
  /** You reported it; hidden from browsing on this device. */
  hidden: boolean;
  /** For your own listings: id and review status on the marketplace server, once published there. */
  remoteId: string | null;
  remoteStatus: ListingStatus | null;
}

export interface ListingDetail extends Listing {
  access: EntitlementStatus;
  reviews: Review[];
  /** Server reviews come from people who had access. Local reviews are yours, kept on this device. */
  reviewsScope: 'server' | 'this_device';
  canReview: boolean;
  reviewBlockedReason: string | null;
  myReport: AbuseReport | null;
  /** Your own use of this listing on this device. */
  yourUsage: { views: number; copies: number; inserts: number; saves: number };
  versions: { version: string; changelog: string; createdAt: IsoTime }[];
  /** Prompt id if you already saved it to your library. */
  inLibrary: Id | null;
}

export interface MarketplaceStatus {
  serverUrl: string;
  info: { name: string; version: string; paymentsEnabled: boolean; trialDays: number; registrationOpen: boolean; demoContent: boolean } | null;
  error: string | null;
  account: (MarketplaceAccount & { role: 'user' | 'admin' }) | null;
  /** Where the sign-in token is kept: OS-encrypted storage, or memory only for this session. */
  tokenStorage: 'secure' | 'session' | null;
}

export interface ListingDraftInput {
  title: string;
  summary: string;
  preview: string;
  body: string;
  category: string;
  tags: string[];
  providers: ProviderLabel[];
  pricing: { type: 'free' } | { type: 'paid'; priceCents: number; currency: 'USD' | 'EUR' | 'GBP' };
  trialEligible: boolean;
  version: string;
  changelog: string;
}

export interface PublishCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string | null;
}

export interface ListingQuery {
  search?: string;
  category?: string;
  pricing?: 'any' | 'free' | 'paid';
  origin?: ListingOrigin | 'any';
  sort?: 'recent' | 'rating' | 'title';
}

export interface Review {
  id: Id;
  listingId: Id;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  /** True when the reviewer actually had access to the prompt (free use, trial or purchase). */
  verified: boolean;
  createdAt: IsoTime;
}

export interface AbuseReport {
  id: Id;
  listingId: Id;
  reason: 'spam' | 'harmful' | 'copyright' | 'misleading' | 'other';
  details: string;
  status: 'open' | 'reviewed' | 'dismissed';
  createdAt: IsoTime;
}

export interface Entitlement {
  id: Id;
  listingId: Id;
  kind: 'free' | 'trial' | 'purchase';
  startsAt: IsoTime;
  expiresAt: IsoTime | null;
  /** "local" = enforced on this device only. "server" = issued and enforced by a marketplace server. */
  authority: 'local' | 'server';
  revokedAt: IsoTime | null;
}

export interface EntitlementStatus {
  listingId: Id;
  access: 'free' | 'trial_active' | 'trial_expired' | 'purchased' | 'none';
  expiresAt: IsoTime | null;
  remainingMs: number | null;
  trialAvailable: boolean;
  authority: 'local' | 'server' | null;
  reason: string;
}

export interface ListingAnalytics {
  listingId: Id;
  views: number;
  copies: number;
  inserts: number;
  savesToLibrary: number;
  /** Analytics only include events recorded on this device unless a server reports more. */
  scope: 'this_device' | 'server';
}

export interface MarketplaceAccount {
  serverUrl: string;
  email: string;
  displayName: string;
  creatorId: Id;
  loggedInAt: IsoTime;
}

// ───────────────────────────── Parental controls ─────────────────────────────

export interface ParentalConfig {
  copyRestriction: boolean;
  screenCapturePrivacy: boolean;
  tutorMode: boolean;
  hideGamesOutsideSessions: boolean;
  sessionAllowedModules: string[];
}

export interface ParentalStatus {
  enabled: boolean;
  configuredAt: IsoTime | null;
  config: ParentalConfig;
  lockedUntil: IsoTime | null;
  failedAttempts: number;
  /** What the OS actually allows for each control on this machine. */
  platform: {
    os: string;
    copyRestriction: { supported: boolean; scope: string };
    screenCapturePrivacy: { supported: boolean; applied: boolean; detail: string };
  };
  session: StudySession | null;
}

export interface StudySession {
  id: Id;
  goal: string;
  allowedModules: string[];
  startedAt: IsoTime;
  endsAt: IsoTime;
  endedAt: IsoTime | null;
  endedBy: 'timer' | 'parent' | null;
}

// ───────────────────────────── Browser bridge ─────────────────────────────

export interface BridgeStatus {
  enabled: boolean;
  listening: boolean;
  port: number;
  error: string | null;
  paired: boolean;
  pairingCode: string | null;
  lastRequestAt: IsoTime | null;
}

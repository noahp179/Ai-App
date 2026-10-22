import type { AppMode, Settings, SettingsPatch } from './settings';
import type { CompanionState } from './ipc';
import type {
  AiStreamEvent,
  AiTask,
  AiTaskState,
  AppInfo,
  Bookmark,
  CalendarEvent,
  Capabilities,
  CaptureKind,
  CaptureResult,
  Conversation,
  EntityLink,
  EventOccurrence,
  FeedAlert,
  FeedItem,
  FeedQuery,
  FeedRefreshResult,
  FeedSource,
  FocusSession,
  FocusStats,
  Folder,
  GameId,
  GameScore,
  GameStats,
  AbuseReport,
  CreatorProfile,
  InboxNotification,
  Listing,
  ListingDetail,
  ListingDraftInput,
  ListingQuery,
  ListingStatus,
  MarketplaceAccount,
  MarketplaceStatus,
  Prompt,
  PromptVersion,
  ProviderLabel,
  PublishCheck,
  LearningOverview,
  LearningPathView,
  LearningQuery,
  LearningRecommendation,
  LearningResourceView,
  LinkableType,
  Message,
  ModelInfo,
  Note,
  NoteDraft,
  NoteFormat,
  NoteQuery,
  NoteSummary,
  ProviderCapabilities,
  ProviderConfig,
  ProviderKind,
  ProviderStatus,
  RecurrenceRule,
  ReminderRecord,
  ResourceProgress,
  ResourceStatus,
  SearchHit,
  SendMessageInput,
  StartupReport,
  Task,
  TaskList,
  TaskPriority,
  TaskQuery,
  TimeEntry,
} from './types';

export interface ImportReport {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface SaveResult {
  saved: boolean;
  path: string | null;
}

export interface NoteInput {
  title?: string;
  body?: string;
  format?: NoteFormat;
  folderId?: string | null;
  tags?: string[];
  pinned?: boolean;
  favorite?: boolean;
}

export interface PromptInput {
  title?: string;
  description?: string;
  body?: string;
  category?: string;
  tags?: string[];
  providers?: ProviderLabel[];
  favorite?: boolean;
}

export interface PromptQuery {
  search?: string;
  category?: string;
  favorite?: boolean;
  provider?: ProviderLabel;
  sort?: 'recent' | 'used' | 'title';
}

export interface TaskInput {
  title: string;
  listId?: string | null;
  parentId?: string | null;
  notes?: string;
  priority?: TaskPriority;
  dueAt?: string | null;
}

export interface EventInputData {
  title: string;
  notes?: string;
  location?: string;
  meetingUrl?: string;
  category?: string;
  allDay?: boolean;
  start: string;
  end: string;
  timeZone: string;
  recurrence?: RecurrenceRule | null;
  checklist?: { id: string; text: string; done: boolean }[];
  reminders?: number[];
}

export type OccurrenceScope = 'this' | 'following' | 'all';

export type ProviderView = ProviderConfig & { options: Record<string, unknown> };

export interface ProviderInputData {
  kind: ProviderKind;
  name?: string;
  baseUrl?: string;
  defaultModel?: string | null;
  enabled?: boolean;
  apiKey?: string | null;
  options?: Record<string, unknown>;
}

export interface ProviderCatalogEntry {
  kind: ProviderKind;
  label: string;
  defaultBaseUrl: string;
  capabilities: ProviderCapabilities;
  suggestedModels: ModelInfo[];
  setupHelp: string;
}

/**
 * The complete surface the UI can call. The main process implements this
 * interface (see src/main/api.ts); every method is reachable over IPC as
 * "namespace.method". Return values are wrapped in promises on the UI side.
 */
export interface FlowApi {
  app: {
    info(): AppInfo;
    capabilities(): Capabilities;
    startupReport(): StartupReport;
    openExternal(url: string): boolean;
    copyText(text: string, context: CopyContext): CopyResult;
    relaunch(): void;
    quit(): void;
    setLastRoute(route: string): void;
  };
  settings: {
    get(): Settings;
    update(patch: SettingsPatch): Settings;
    applyMode(mode: AppMode): Settings;
    reset(section?: keyof Settings): Settings;
    timeZones(): string[];
    shortcutStatus(): ShortcutStatus[];
  };
  window: {
    showMain(route?: string): void;
    toggleCompanion(): CompanionState;
    companionState(): CompanionState;
    setCompanionCollapsed(collapsed: boolean): CompanionState;
    setCompanionDock(dock: CompanionState['dock']): CompanionState;
    hideCompanion(): CompanionState;
    minimizeCompanion(): void;
    expandToMain(route?: string): void;
  };
  inbox: {
    list(limit?: number): InboxNotification[];
    unreadCount(): number;
    markRead(id: string): void;
    markAllRead(): void;
    clear(): void;
    pause(minutes: number): string;
    resume(): void;
    pausedUntil(): string | null;
    snooze(notificationId: string, minutes?: number): ReminderRecord;
  };
  data: {
    inventory(): { table: string; label: string; description: string; rows: number }[];
    exportAll(): Promise<SaveResult>;
    backups(): { file: string; size: number; createdAt: string }[];
    createBackup(): { file: string };
    restoreBackup(file: string): void;
    deleteAll(confirmation: string): void;
    openFolder(): void;
  };
  news: {
    categories(): { id: string; label: string }[];
    sources(): FeedSource[];
    addSource(input: { url: string; name?: string; category?: string }): Promise<{ source: FeedSource; result: FeedRefreshResult }>;
    updateSource(id: string, patch: { name?: string; category?: string; enabled?: boolean; blocked?: boolean }): FeedSource;
    removeSource(id: string): void;
    refresh(sourceIds?: string[]): Promise<FeedRefreshResult[]>;
    lastRefresh(): string | null;
    items(query?: FeedQuery): FeedItem[];
    duplicates(id: string): FeedItem[];
    markRead(id: string, read: boolean): void;
    markAllRead(category?: string): number;
    setSaved(id: string, saved: boolean): FeedItem;
    addToReadingQueue(id: string): Bookmark;
    unreadCount(): number;
    alerts(): FeedAlert[];
    addAlert(keyword: string): FeedAlert;
    setAlertEnabled(id: string, enabled: boolean): void;
    removeAlert(id: string): void;
  };
  games: {
    stats(game: GameId, filter?: { key: string; value: string }): GameStats;
    all(): GameStats[];
    record(game: GameId, score: number, detail?: Record<string, string | number | boolean>): GameScore;
    saveState(game: GameId, state: unknown): void;
    loadState(game: GameId): unknown;
    clearState(game: GameId): void;
    resetScores(game?: GameId): void;
  };
  learning: {
    overview(): LearningOverview;
    resources(query?: LearningQuery): LearningResourceView[];
    resource(id: string): LearningResourceView;
    paths(): LearningPathView[];
    path(id: string): LearningPathView & { resources: LearningResourceView[] };
    recommendations(): { personalized: boolean; items: LearningRecommendation[] };
    setSaved(id: string, saved: boolean): ResourceProgress;
    setStatus(id: string, status: ResourceStatus): ResourceProgress;
    setNotes(id: string, notes: string): ResourceProgress;
    /** Opens the resource in the default browser and remembers when it was last opened. */
    open(id: string): Promise<void>;
    /** Adds a study session for this resource to the local calendar (category "study"), linked to the resource. */
    schedule(id: string, input: { start: string; end: string; timeZone: string; recurrence?: RecurrenceRule | null }): CalendarEvent;
    /** Creates a Markdown note about the resource, linked to it. */
    createNote(id: string): Note;
    exportData(): Promise<SaveResult>;
    deleteData(): number;
  };
  prompts: {
    list(query?: PromptQuery): Prompt[];
    get(id: string): Prompt;
    create(input: PromptInput): Prompt;
    /** Changing title or text creates a new version; `note` describes the change. */
    update(id: string, patch: PromptInput, note?: string): Prompt;
    setFavorite(id: string, favorite: boolean): Prompt;
    versions(id: string): PromptVersion[];
    restoreVersion(id: string, version: number): Prompt;
    duplicate(id: string): Prompt;
    delete(id: string): void;
    recordUse(id: string): Prompt;
    categories(): { category: string; count: number }[];
    exportFile(ids?: string[]): Promise<SaveResult>;
    importFile(): Promise<ImportReport | null>;
  };
  marketplace: {
    status(): Promise<MarketplaceStatus>;
    listings(query?: ListingQuery): Promise<{ items: Listing[]; remoteError: string | null }>;
    listing(key: string): Promise<ListingDetail>;
    creator(key: string): Promise<{ creator: CreatorProfile; listings: Listing[] }>;
    /** The prompt text when you have access; records a copy/insert on this device. */
    promptText(key: string, use: 'copy' | 'insert'): Promise<string>;
    saveToLibrary(key: string): Promise<Prompt>;
    /** Server-enforced trial. `acknowledged` confirms the user accepted the disclosure. */
    startTrial(key: string, acknowledged: boolean): Promise<ListingDetail>;
    purchase(key: string): Promise<void>;
    addReview(key: string, input: { rating: number; text: string }): Promise<void>;
    report(key: string, input: { reason: AbuseReport['reason']; details: string }): Promise<{ sentTo: 'server' | 'this_device' }>;
    myReports(): (AbuseReport & { listingTitle: string | null })[];
    resolveLocalReport(id: string, action: 'restore' | 'remove_listing' | 'dismiss'): void;
    register(input: { email: string; password: string; displayName: string }): Promise<MarketplaceAccount>;
    login(input: { email: string; password: string }): Promise<MarketplaceAccount>;
    logout(): Promise<void>;
    moderationQueue(): Promise<{ pending: Listing[]; reports: { id: string; listingId: string; listingTitle: string; reason: string; details: string; status: string; createdAt: string }[] }>;
    moderate(remoteId: string, action: 'approve' | 'reject' | 'remove', note: string): Promise<Listing>;
    resolveServerReport(id: string, action: 'reviewed' | 'dismissed'): Promise<void>;
  };
  creator: {
    profile(): CreatorProfile;
    saveProfile(input: { displayName: string; bio: string; website: string }): Promise<CreatorProfile>;
    listings(): Listing[];
    sync(): Promise<Listing[]>;
    createDraft(input?: Partial<ListingDraftInput>): Listing;
    fromPrompt(promptId: string): Listing;
    draft(id: string): ListingDraftInput & { id: string; status: ListingStatus; remoteId: string | null; remoteStatus: ListingStatus | null; moderationNote: string | null };
    updateDraft(id: string, patch: Partial<ListingDraftInput>): Listing;
    deleteDraft(id: string): void;
    checks(id: string): PublishCheck[];
    publish(id: string): Promise<Listing>;
    unpublish(id: string): Promise<Listing>;
    analytics(id: string): Promise<{ server: { views: number; trialStarts: number; acquisitions: number; reviews: number; averageRating: number | null } | null; note: string }>;
    exportPackage(id: string): Promise<SaveResult>;
    importPackage(): Promise<Listing | null>;
  };
  calendar: {
    occurrences(fromIso: string, toIso: string): EventOccurrence[];
    get(id: string): CalendarEvent;
    create(input: EventInputData): CalendarEvent;
    update(id: string, patch: Partial<EventInputData>): CalendarEvent;
    delete(id: string): void;
    updateOccurrence(id: string, key: string, patch: { title?: string; start?: string; end?: string; location?: string; notes?: string }, scope: OccurrenceScope): CalendarEvent;
    deleteOccurrence(id: string, key: string, scope: OccurrenceScope): void;
    restoreOccurrence(id: string, key: string): CalendarEvent;
    categories(): string[];
    exportIcs(): Promise<SaveResult>;
  };
  reminders: {
    list(includeDone?: boolean): ReminderRecord[];
    overdue(): ReminderRecord[];
    create(input: { title: string; body?: string; fireAt: string; refType?: ReminderRecord['refType']; refId?: string | null }): ReminderRecord;
    update(id: string, patch: { title?: string; body?: string; fireAt?: string }): ReminderRecord;
    complete(id: string): void;
    dismiss(id: string): void;
    delete(id: string): void;
    snooze(id: string, minutes: number): ReminderRecord;
  };
  notes: {
    list(query?: NoteQuery): NoteSummary[];
    get(id: string): Note;
    create(input?: NoteInput): Note;
    update(id: string, patch: NoteInput & { expectedRevision?: number }): Note;
    duplicate(id: string): Note;
    archive(id: string): Note;
    unarchive(id: string): Note;
    trash(id: string): void;
    restore(id: string): Note;
    deletePermanently(id: string): void;
    emptyTrash(): number;
    tags(): { tag: string; count: number }[];
    folders(): (Folder & { noteCount: number })[];
    createFolder(name: string, parentId?: string | null): Folder;
    renameFolder(id: string, name: string): void;
    deleteFolder(id: string): void;
    saveDraft(noteId: string, title: string, body: string, baseRevision: number): void;
    drafts(): (NoteDraft & { noteTitle: string; differs: boolean })[];
    draftFor(noteId: string): NoteDraft | null;
    discardDraft(noteId: string): void;
    recoverDraft(noteId: string): Note;
    exportNote(id: string, format: 'markdown' | 'text' | 'json'): Promise<SaveResult>;
    exportAll(): Promise<SaveResult>;
    importFiles(): Promise<ImportReport | null>;
  };
  links: {
    link(fromType: LinkableType, fromId: string, toType: LinkableType, toId: string): EntityLink;
    unlink(id: string): void;
    for(type: LinkableType, id: string): EntityLink[];
  };
  tasks: {
    lists(): TaskList[];
    createList(name: string): TaskList;
    renameList(id: string, name: string): void;
    deleteList(id: string): void;
    list(query?: TaskQuery): Task[];
    get(id: string): Task;
    create(input: TaskInput): Task;
    update(id: string, patch: Partial<TaskInput> & { done?: boolean }): Task;
    toggle(id: string, done: boolean): Task;
    delete(id: string): void;
    move(id: string, beforeId: string | null, afterId: string | null): void;
    clearCompleted(listId: string | null): number;
    counts(): { open: number; dueToday: number; overdue: number; doneToday: number };
  };
  bookmarks: {
    list(query?: { search?: string; tag?: string; queue?: 'reading' | 'unread' | 'read' | 'all' }): Bookmark[];
    create(input: { url: string; title?: string; description?: string; tags?: string[]; queue?: Bookmark['queue'] }): Bookmark;
    update(id: string, patch: { url?: string; title?: string; description?: string; tags?: string[]; queue?: Bookmark['queue'] }): Bookmark;
    setRead(id: string, read: boolean): Bookmark;
    delete(id: string): void;
    tags(): string[];
  };
  time: {
    running(): TimeEntry | null;
    start(label: string, taskId?: string | null): TimeEntry;
    stop(): TimeEntry | null;
    list(days?: number): TimeEntry[];
    update(id: string, patch: { label?: string; startedAt?: string; endedAt?: string | null }): TimeEntry;
    delete(id: string): void;
    summary(days?: number): { byLabel: { label: string; minutes: number }[]; byDay: { date: string; minutes: number }[]; totalMinutes: number };
  };
  focus: {
    current(): FocusSession | null;
    start(kind?: FocusSession['kind'], minutes?: number, label?: string): FocusSession;
    pause(): FocusSession | null;
    resume(): FocusSession | null;
    stop(): FocusSession | null;
    stats(): FocusStats;
    history(limit?: number): FocusSession[];
    nextKind(): FocusSession['kind'];
  };
  search: {
    query(q: string, types?: SearchHit['type'][]): SearchHit[];
  };
  capture: {
    capture(input: { text: string; kind?: CaptureKind | null; dueAt?: string | null }): CaptureResult;
  };
  ai: {
    status(): { configured: boolean; providerCount: number; defaultProviderId: string | null; activeRequests: number; secureStorage: boolean };
    catalog(): ProviderCatalogEntry[];
    providers(): ProviderView[];
    createProvider(input: ProviderInputData): ProviderView;
    updateProvider(id: string, patch: Partial<ProviderInputData>): ProviderView;
    deleteProvider(id: string): void;
    setApiKey(id: string, key: string | null): 'secure' | 'session' | 'none';
    testProvider(id: string): Promise<ProviderStatus>;
    models(id: string): ModelInfo[];
    conversations(query?: { archived?: boolean; search?: string }): Conversation[];
    conversation(id: string): Conversation;
    messages(conversationId: string): Message[];
    createConversation(input?: { title?: string; providerId?: string | null; model?: string | null; systemPrompt?: string }): Conversation;
    updateConversation(id: string, patch: { title?: string; providerId?: string | null; model?: string | null; systemPrompt?: string }): Conversation;
    archiveConversation(id: string, archived: boolean): Conversation;
    deleteConversation(id: string): void;
    deleteAllConversations(): number;
    send(input: SendMessageInput): { userMessage: Message; assistantMessage: Message };
    retry(messageId: string, opts?: { providerId?: string | null; model?: string | null }): Message;
    cancel(messageId: string): boolean;
    exportConversation(id: string, format: 'markdown' | 'json'): Promise<SaveResult>;
    toNote(conversationId: string, messageId?: string | null): Note;
    toTask(messageId: string): Task;
    tasks(active?: boolean): AiTask[];
    startTimer(title: string, minutes: number, url?: string | null): AiTask;
    setTaskState(id: string, state: AiTaskState): AiTask;
    deleteTask(id: string): void;
    clearFinishedTasks(): number;
  };
}

/** Where a copy request came from; parental copy restrictions apply per context. */
export type CopyContext = 'ai' | 'learning' | 'notes' | 'prompts' | 'marketplace' | 'general';
export interface CopyResult {
  copied: boolean;
  reason: string | null;
}

export interface ShortcutStatus {
  name: 'toggleCompanion' | 'quickCapture' | 'showMainWindow';
  accelerator: string;
  registered: boolean;
  error: string | null;
}

export type { AiStreamEvent };

type Fn = (...args: never[]) => unknown;
/** UI-side view of the API: every call is async. */
export type AsyncApi<T> = {
  [Ns in keyof T]: {
    [M in keyof T[Ns]]: T[Ns][M] extends Fn
      ? (...args: Parameters<T[Ns][M]>) => Promise<Awaited<ReturnType<T[Ns][M]>>>
      : never;
  };
};

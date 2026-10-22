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
  FocusSession,
  FocusStats,
  Folder,
  InboxNotification,
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

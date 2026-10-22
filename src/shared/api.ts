import type { AppMode, Settings, SettingsPatch } from './settings';
import type { CompanionState } from './ipc';
import type { AppInfo, Capabilities, InboxNotification, StartupReport } from './types';

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
  inbox: {
    list(limit?: number): InboxNotification[];
    unreadCount(): number;
    markRead(id: string): void;
    markAllRead(): void;
    clear(): void;
    pause(minutes: number): string;
    resume(): void;
    pausedUntil(): string | null;
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

type Fn = (...args: never[]) => unknown;
/** UI-side view of the API: every call is async. */
export type AsyncApi<T> = {
  [Ns in keyof T]: {
    [M in keyof T[Ns]]: T[Ns][M] extends Fn
      ? (...args: Parameters<T[Ns][M]>) => Promise<Awaited<ReturnType<T[Ns][M]>>>
      : never;
  };
};

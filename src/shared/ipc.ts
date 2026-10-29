/** IPC envelope shared by main and preload. One invoke channel, one event channel. */
export const INVOKE_CHANNEL = 'fc:invoke';
export const EVENT_CHANNEL = 'fc:event';

export type InvokeResult<T> = { ok: true; value: T } | { ok: false; error: { message: string; code: string } };

/** Events pushed from the main process to every window. */
export interface AppEvents {
  'settings.changed': import('./settings').Settings;
  'data.changed': { entity: string; id?: string };
  'navigate': { route: string };
  'ai.stream': import('./types').AiStreamEvent;
  'ai.task': import('./types').AiTask;
  'notification': import('./types').InboxNotification;
  'quickCapture.open': { kind?: import('./types').CaptureKind };
  'companion.state': CompanionState;
  'parental.changed': import('./types').ParentalStatus;
  'focus.tick': import('./types').FocusSession | null;
  'feed.refreshed': import('./types').FeedRefreshResult[];
  'bridge.status': import('./types').BridgeStatus;
  'study.tutor': import('./study/api').TutorStreamEvent;
  'curriculum.progress': { message: string };
}

export type AppEventName = keyof AppEvents;
export interface AppEventMessage<K extends AppEventName = AppEventName> {
  type: K;
  payload: AppEvents[K];
}

export interface CompanionState {
  visible: boolean;
  collapsed: boolean;
  dock: 'floating' | 'left' | 'right';
  alwaysOnTop: boolean;
}

/** Exposed by the preload script as window.fc. */
export interface PreloadBridge {
  invoke(method: string, args: unknown[]): Promise<InvokeResult<unknown>>;
  onEvent(listener: (message: AppEventMessage) => void): () => void;
  platform: string;
}

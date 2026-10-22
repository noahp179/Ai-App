import type { AsyncApi, FlowApi } from '../../shared/api';
import type { AppEventMessage, AppEventName, AppEvents, PreloadBridge } from '../../shared/ipc';

declare global {
  interface Window {
    fc: PreloadBridge;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Typed client: api.notes.list(query) → IPC "notes.list". */
export const api = new Proxy({} as AsyncApi<FlowApi>, {
  get(_target, ns: string) {
    return new Proxy(
      {},
      {
        get(_t, method: string) {
          return async (...args: unknown[]) => {
            const res = await window.fc.invoke(`${ns}.${method}`, args);
            if (!res.ok) throw new ApiError(res.error.message, res.error.code);
            return res.value;
          };
        },
      },
    );
  },
});

type Handler<K extends AppEventName> = (payload: AppEvents[K]) => void;
const handlers = new Map<AppEventName, Set<Handler<AppEventName>>>();
let subscribed = false;

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  window.fc.onEvent((msg: AppEventMessage) => {
    for (const h of handlers.get(msg.type) ?? []) {
      try {
        h(msg.payload);
      } catch (err) {
        console.error(err);
      }
    }
  });
}

export function onAppEvent<K extends AppEventName>(type: K, handler: Handler<K>): () => void {
  ensureSubscribed();
  let set = handlers.get(type);
  if (!set) {
    set = new Set();
    handlers.set(type, set);
  }
  set.add(handler as Handler<AppEventName>);
  return () => set.delete(handler as Handler<AppEventName>);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

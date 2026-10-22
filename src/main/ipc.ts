import { ipcMain } from 'electron';
import { UserError } from '../core/util';
import type { FlowApi } from '../shared/api';
import { INVOKE_CHANNEL, type InvokeResult } from '../shared/ipc';
import { isAppUrl } from './security';

type AnyFn = (...args: unknown[]) => unknown;

export function buildRegistry(api: FlowApi): Map<string, AnyFn> {
  const registry = new Map<string, AnyFn>();
  for (const [ns, methods] of Object.entries(api)) {
    for (const [name, fn] of Object.entries(methods as Record<string, unknown>)) {
      if (typeof fn === 'function') registry.set(`${ns}.${name}`, fn as AnyFn);
    }
  }
  return registry;
}

/**
 * One invoke channel for the whole API. Only frames served from the app itself
 * may call it, only registered methods can be reached, and errors come back as
 * data so the UI can show them.
 */
export function registerIpc(api: FlowApi): Map<string, AnyFn> {
  const registry = buildRegistry(api);
  ipcMain.handle(INVOKE_CHANNEL, async (event, method: unknown, args: unknown): Promise<InvokeResult<unknown>> => {
    const senderUrl = event.senderFrame?.url ?? '';
    if (!isAppUrl(senderUrl)) {
      return { ok: false, error: { code: 'forbidden', message: 'Request rejected: not sent by FlowCompanion.' } };
    }
    if (typeof method !== 'string' || !Array.isArray(args)) {
      return { ok: false, error: { code: 'bad_request', message: 'Malformed request.' } };
    }
    const fn = registry.get(method);
    if (!fn) return { ok: false, error: { code: 'unknown_method', message: `Unknown method: ${method}` } };
    try {
      return { ok: true, value: await fn(...args) };
    } catch (err) {
      if (err instanceof UserError) return { ok: false, error: { code: err.code, message: err.message } };
      console.error(`[ipc] ${method} failed`, err);
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'internal', message: `Something went wrong: ${message}` } };
    }
  });
  return registry;
}

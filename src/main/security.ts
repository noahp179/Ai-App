import { app, session, shell, type WebContents } from 'electron';
import { APP_ORIGIN } from './protocol';

const devUrl = process.env.FC_DEV_SERVER_URL ?? null;

export function isAppUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (`${u.protocol}//${u.host}` === APP_ORIGIN) return true;
    if (devUrl) return u.origin === new URL(devUrl).origin;
    return false;
  } catch {
    return false;
  }
}

/** Opens a link in the user's browser. Only web and mail links are allowed. */
export function openExternalSafe(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) return false;
  if (u.username || u.password) return false;
  void shell.openExternal(u.toString());
  return true;
}

/**
 * Locks down every web contents the app creates: no new windows, no navigation
 * away from the app, no <webview>, and no browser permissions (camera,
 * geolocation, notifications from the page, etc.). OS notifications are shown
 * by the main process instead.
 */
export function hardenSessions(): void {
  app.on('web-contents-created', (_event, contents: WebContents) => {
    contents.setWindowOpenHandler(({ url }) => {
      openExternalSafe(url);
      return { action: 'deny' };
    });
    const guard = (event: Electron.Event, url: string) => {
      if (!isAppUrl(url)) {
        event.preventDefault();
        openExternalSafe(url);
      }
    };
    contents.on('will-navigate', guard);
    contents.on('will-redirect', guard);
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);

  if (devUrl) {
    // The Vite dev server needs inline scripts and a websocket for hot reload.
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders };
      if (details.url.startsWith(devUrl)) {
        headers['Content-Security-Policy'] = [
          `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:*; object-src 'none'; frame-src 'none'`,
        ];
      }
      callback({ responseHeaders: headers });
    });
  }
}

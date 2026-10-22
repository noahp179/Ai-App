// Talks to the FlowCompanion desktop app over its local bridge (127.0.0.1 only).
// Nothing here contacts any other server.

export const DEFAULT_PORT = 47823;

export async function getConfig() {
  const c = await chrome.storage.local.get(['port', 'token']);
  return { port: Number(c.port) || DEFAULT_PORT, token: typeof c.token === 'string' ? c.token : null };
}

export async function setConfig(patch) {
  await chrome.storage.local.set(patch);
}

export class BridgeError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function call(method, path, body) {
  const { port, token } = await getConfig();
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new BridgeError(`FlowCompanion is not reachable on port ${port}. Open the app and turn on Settings → Browser → Browser bridge.`, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BridgeError(data.error || `FlowCompanion returned an error (${res.status}).`, res.status);
  return data;
}

export const status = () => call('GET', '/v1/status');

export async function pair(code) {
  const r = await call('POST', '/v1/pair', { code, name: `${navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Chromium browser'} extension` });
  await setConfig({ token: r.token });
  return r;
}

export async function unpairLocally() {
  await chrome.storage.local.remove('token');
}

export const savePage = (tab) => call('POST', '/v1/capture', { kind: 'reading', title: tab.title || '', url: tab.url || '' });
export const saveSelection = (text, tab) => call('POST', '/v1/capture', { kind: 'note', title: tab?.title || 'Clipping', text, url: tab?.url || '' });
export const saveTask = (text, tab) => call('POST', '/v1/capture', { kind: 'task', text, url: tab?.url || '' });
export const ask = (text, tab) => call('POST', '/v1/ask', { text, title: tab?.title || '', url: tab?.url || '' });

/** Only regular web pages can be saved; browser-internal pages are refused here as well as in the app. */
export function isWebPage(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

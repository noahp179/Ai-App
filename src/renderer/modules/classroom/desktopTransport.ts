import { ClassroomError, type ClassroomTransport } from '../../../shared/classroom/transport';
import { api, ApiError, onAppEvent } from '../../lib/api';

/** Turns "classroom:403:forbidden" back into the server's status and code. */
function unwrap(err: unknown): never {
  if (err instanceof ApiError) {
    const m = /^classroom:(\d+):(.+)$/.exec(err.code);
    if (m) throw new ClassroomError(Number(m[1]), m[2]!, err.message);
    throw new ClassroomError(0, err.code, err.message);
  }
  throw err;
}

let seq = 0;

export const desktopTransport: ClassroomTransport = {
  kind: 'desktop',
  status: () => api.classroom.status().catch(unwrap),
  connect: (url) => api.classroom.connect(url).catch(unwrap),
  disconnect: () => api.classroom.disconnect().catch(unwrap),
  request: <T,>(method: Parameters<ClassroomTransport['request']>[0], path: string, body?: unknown) => api.classroom.request(method, path, body).then((v) => v as T, unwrap),
  upload: <T,>(path: string, query: Record<string, string>, file: { name: string; type: string; bytes: Uint8Array }) => api.classroom.upload(path, query, file.name, file.type, file.bytes).then((v) => v as T, unwrap),
  async stream(path, body, onEvent) {
    const id = `s${Date.now()}-${++seq}`;
    const off = onAppEvent('classroom.stream', (m) => {
      if (m.streamId === id) onEvent(m.event);
    });
    try {
      await api.classroom.stream(path, body, id).catch(unwrap);
    } finally {
      off();
    }
  },
  saveText: (filename, text) => api.classroom.saveText(filename, text).catch(unwrap),
  setAssessmentLock: (on) => api.classroom.setAssessmentLock(on).catch(unwrap),
};

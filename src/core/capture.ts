import type { CaptureKind, CaptureResult } from '../shared/types';
import type { BookmarksService } from './bookmarks';
import type { NotesService } from './notes';
import { titleFromBody } from './notes';
import type { TasksService } from './tasks';
import { UserError, safeHttpUrl } from './util';

const PREFIXES: [RegExp, CaptureKind][] = [
  [/^(t|task|todo)[:\s]\s*/i, 'task'],
  [/^(n|note)[:\s]\s*/i, 'note'],
  [/^(b|bookmark)[:\s]\s*/i, 'bookmark'],
  [/^(r|read|later)[:\s]\s*/i, 'reading'],
];

/** Works out what a quick-capture line is: explicit prefix, a bare URL, or a note. */
export function classifyCapture(text: string, explicit?: CaptureKind | null): { kind: CaptureKind; text: string } {
  const trimmed = text.trim();
  if (explicit) return { kind: explicit, text: trimmed };
  for (const [re, kind] of PREFIXES) {
    if (re.test(trimmed)) return { kind, text: trimmed.replace(re, '') };
  }
  if (/^https?:\/\/\S+$/i.test(trimmed)) return { kind: 'bookmark', text: trimmed };
  return { kind: 'note', text: trimmed };
}

export class CaptureService {
  constructor(
    private readonly notes: NotesService,
    private readonly tasks: TasksService,
    private readonly bookmarks: BookmarksService,
  ) {}

  capture(input: { text: string; kind?: CaptureKind | null; dueAt?: string | null; url?: string | null }): CaptureResult {
    if (typeof input?.text !== 'string') throw new UserError('Nothing to capture.');
    const { kind, text } = classifyCapture(input.text, input.kind);
    if (!text && !input.url) throw new UserError('Nothing to capture.');
    const [first = '', ...rest] = text.split('\n');
    switch (kind) {
      case 'task': {
        const t = this.tasks.create({ title: first || 'Untitled task', notes: rest.join('\n').trim(), dueAt: input.dueAt ?? null });
        return { kind, id: t.id, title: t.title };
      }
      case 'bookmark':
      case 'reading': {
        const urlMatch = /https?:\/\/\S+/i.exec(text);
        const url = safeHttpUrl(input.url ?? urlMatch?.[0] ?? '');
        if (!url) throw new UserError('Bookmarks need a web address (http:// or https://).');
        const title = text.replace(urlMatch?.[0] ?? '', '').trim().split('\n')[0] ?? '';
        const b = this.bookmarks.create({ url, title, queue: kind === 'reading' ? 'unread' : 'none' });
        return { kind, id: b.id, title: b.title };
      }
      case 'note': {
        const n = this.notes.create({ title: titleFromBody(text, 'Quick note'), body: text });
        return { kind, id: n.id, title: n.title };
      }
      default:
        throw new UserError('Events are created from the calendar.');
    }
  }
}

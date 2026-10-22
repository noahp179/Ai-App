import type { SearchHit } from '../shared/types';
import type { Db } from './db/database';
import { ftsQuery } from './db/database';

/** Marks highlighted terms in snippets. The UI splits on these; they never reach HTML. */
export const HL_START = '\u0002';
export const HL_END = '\u0003';

type IndexType = 'note' | 'task' | 'prompt' | 'conversation' | 'message' | 'event' | 'bookmark' | 'article';

export interface ExtraSource {
  search(q: string, limit: number): SearchHit[];
}

/** Searches every local content type through the shared FTS5 index. */
export class SearchService {
  constructor(
    private readonly db: Db,
    private readonly extra: ExtraSource[] = [],
  ) {}

  search(q: string, opts: { types?: SearchHit['type'][]; limit?: number } = {}): SearchHit[] {
    const query = ftsQuery(String(q ?? ''));
    if (!query) return [];
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 200);
    const rows = this.db.all<{ type: IndexType; ref_id: string; parent_id: string; title: string; snip: string }>(
      `SELECT type, ref_id, parent_id, title, snippet(search_index, 4, ?, ?, '…', 14) AS snip
       FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT ?`,
      [HL_START, HL_END, query, limit * 3],
    );
    const hits: SearchHit[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      let type: SearchHit['type'];
      let id = r.ref_id;
      let title = r.title;
      if (r.type === 'message') {
        type = 'conversation';
        id = r.parent_id;
        title = this.db.get<{ title: string }>('SELECT title FROM conversations WHERE id = ?', [id])?.title ?? 'Conversation';
      } else {
        type = r.type;
      }
      if (opts.types && !opts.types.includes(type)) continue;
      const key = `${type}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ type, id, title: title || 'Untitled', snippet: r.snip ?? '', updatedAt: this.updatedAt(type, id) });
      if (hits.length >= limit) break;
    }
    for (const src of this.extra) {
      for (const h of src.search(q, limit)) {
        if (opts.types && !opts.types.includes(h.type)) continue;
        if (hits.length >= limit + 10) break;
        hits.push(h);
      }
    }
    return hits;
  }

  private updatedAt(type: SearchHit['type'], id: string): string | null {
    const table: Partial<Record<SearchHit['type'], string>> = {
      note: 'notes',
      task: 'tasks',
      prompt: 'prompts',
      conversation: 'conversations',
      event: 'events',
      bookmark: 'bookmarks',
    };
    const t = table[type];
    if (!t) return null;
    return this.db.get<{ updated_at: string }>(`SELECT updated_at FROM ${t} WHERE id = ?`, [id])?.updated_at ?? null;
  }
}

import { z } from 'zod';
import type { Bookmark } from '../shared/types';
import type { Db } from './db/database';
import { json } from './db/database';
import { type Clock, NotFoundError, UserError, cleanLine, cleanTags, newId, safeHttpUrl } from './util';

interface Row {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string;
  queue: Bookmark['queue'];
  created_at: string;
  updated_at: string;
  read_at: string | null;
}

const toBookmark = (r: Row): Bookmark => ({
  id: r.id,
  url: r.url,
  title: r.title,
  description: r.description,
  tags: json<string[]>(r.tags, []),
  queue: r.queue,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  readAt: r.read_at,
});

const Input = z.object({
  url: z.string().max(4000),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
  queue: z.enum(['none', 'unread', 'read']).optional(),
});

/** Bookmarks and the reading queue (a bookmark with queue = unread/read). No page is fetched. */
export class BookmarksService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  list(q: { search?: string; tag?: string; queue?: 'reading' | 'unread' | 'read' | 'all' } = {}): Bookmark[] {
    const where: string[] = ['1 = 1'];
    const p: string[] = [];
    if (q.queue === 'reading') where.push("queue IN ('unread', 'read')");
    else if (q.queue === 'unread' || q.queue === 'read') {
      where.push('queue = ?');
      p.push(q.queue);
    }
    if (q.search?.trim()) {
      const like = `%${q.search.trim().replace(/[%_]/g, '')}%`;
      where.push('(title LIKE ? OR url LIKE ? OR description LIKE ?)');
      p.push(like, like, like);
    }
    if (q.tag) {
      where.push('EXISTS (SELECT 1 FROM json_each(bookmarks.tags) WHERE value = ?)');
      p.push(q.tag.toLowerCase());
    }
    const order = q.queue === 'reading' || q.queue === 'unread' ? "CASE queue WHEN 'unread' THEN 0 ELSE 1 END, created_at DESC" : 'created_at DESC';
    return this.db.all<Row>(`SELECT * FROM bookmarks WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 2000`, p).map(toBookmark);
  }

  get(id: string): Bookmark {
    const r = this.db.get<Row>('SELECT * FROM bookmarks WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That bookmark');
    return toBookmark(r);
  }

  create(input: unknown): Bookmark {
    const d = Input.parse(input);
    const url = safeHttpUrl(d.url);
    if (!url) throw new UserError('Enter a full web address starting with http:// or https://');
    const id = newId();
    const now = this.clock.now().toISOString();
    const title = cleanLine(d.title ?? '', 500) || new URL(url).hostname.replace(/^www\./, '');
    this.db.run(
      'INSERT INTO bookmarks (id, url, title, description, tags, queue, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, url, title, (d.description ?? '').slice(0, 5000), JSON.stringify(cleanTags(d.tags ?? [])), d.queue ?? 'none', now, now],
    );
    return this.get(id);
  }

  update(id: string, patch: unknown): Bookmark {
    const d = Input.partial().parse(patch);
    const cur = this.get(id);
    let url = cur.url;
    if (d.url !== undefined) {
      const u = safeHttpUrl(d.url);
      if (!u) throw new UserError('Enter a full web address starting with http:// or https://');
      url = u;
    }
    const now = this.clock.now().toISOString();
    const queue = d.queue ?? cur.queue;
    this.db.run('UPDATE bookmarks SET url = ?, title = ?, description = ?, tags = ?, queue = ?, read_at = ?, updated_at = ? WHERE id = ?', [
      url,
      d.title !== undefined ? cleanLine(d.title, 500) || cur.title : cur.title,
      d.description ?? cur.description,
      JSON.stringify(d.tags ? cleanTags(d.tags) : cur.tags),
      queue,
      queue === 'read' ? (cur.readAt ?? now) : null,
      now,
      id,
    ]);
    return this.get(id);
  }

  setRead(id: string, read: boolean): Bookmark {
    return this.update(id, { queue: read ? 'read' : 'unread' });
  }

  delete(id: string): void {
    this.db.tx(() => {
      this.db.run("DELETE FROM links WHERE (from_type = 'bookmark' AND from_id = ?) OR (to_type = 'bookmark' AND to_id = ?)", [id, id]);
      if (this.db.run('DELETE FROM bookmarks WHERE id = ?', [id]).changes === 0) throw new NotFoundError('That bookmark');
    });
  }

  tags(): string[] {
    return this.db.all<{ value: string }>('SELECT DISTINCT value FROM bookmarks, json_each(bookmarks.tags) ORDER BY value').map((r) => r.value);
  }
}

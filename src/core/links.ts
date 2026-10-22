import type { EntityLink, LinkableType } from '../shared/types';
import type { Db } from './db/database';
import { type Clock, UserError, newId } from './util';

const TYPES: LinkableType[] = ['note', 'task', 'prompt', 'event', 'conversation', 'bookmark', 'resource'];
const TABLE: Partial<Record<LinkableType, string>> = {
  note: 'notes',
  task: 'tasks',
  prompt: 'prompts',
  event: 'events',
  conversation: 'conversations',
  bookmark: 'bookmarks',
};

/** Explicit, user-created links between notes, tasks, prompts, events, conversations and resources. */
export class LinksService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly resourceTitle: (id: string) => string | null,
  ) {}

  private check(type: unknown): LinkableType {
    if (!TYPES.includes(type as LinkableType)) throw new UserError('Unknown item type.');
    return type as LinkableType;
  }

  title(type: LinkableType, id: string): string | null {
    if (type === 'resource') return this.resourceTitle(id);
    const table = TABLE[type];
    if (!table) return null;
    const r = this.db.get<{ title: string }>(`SELECT title FROM ${table} WHERE id = ?`, [id]);
    return r ? r.title || 'Untitled' : null;
  }

  link(fromType: LinkableType, fromId: string, toType: LinkableType, toId: string): EntityLink {
    this.check(fromType);
    this.check(toType);
    if (fromType === toType && fromId === toId) throw new UserError('An item cannot link to itself.');
    if (this.title(fromType, fromId) === null || this.title(toType, toId) === null) throw new UserError('One of the items no longer exists.');
    const existing = this.db.get<{ id: string }>(
      `SELECT id FROM links WHERE (from_type = ? AND from_id = ? AND to_type = ? AND to_id = ?)
          OR (from_type = ? AND from_id = ? AND to_type = ? AND to_id = ?)`,
      [fromType, fromId, toType, toId, toType, toId, fromType, fromId],
    );
    const id = existing?.id ?? newId();
    const createdAt = this.clock.now().toISOString();
    if (!existing) {
      this.db.run('INSERT INTO links (id, from_type, from_id, to_type, to_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, fromType, fromId, toType, toId, createdAt]);
    }
    return { id, fromType, fromId, toType, toId, createdAt, title: this.title(toType, toId) };
  }

  unlink(id: string): void {
    this.db.run('DELETE FROM links WHERE id = ?', [id]);
  }

  /** Links touching an item, normalized so `toType`/`toId` is always the other side. */
  linksFor(type: LinkableType, id: string): EntityLink[] {
    this.check(type);
    const rows = this.db.all<{ id: string; from_type: LinkableType; from_id: string; to_type: LinkableType; to_id: string; created_at: string }>(
      'SELECT * FROM links WHERE (from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?) ORDER BY created_at',
      [type, id, type, id],
    );
    return rows.map((r) => {
      const forward = r.from_type === type && r.from_id === id;
      const otherType = forward ? r.to_type : r.from_type;
      const otherId = forward ? r.to_id : r.from_id;
      return { id: r.id, fromType: type, fromId: id, toType: otherType, toId: otherId, createdAt: r.created_at, title: this.title(otherType, otherId) };
    });
  }

  /** Removes links whose other side no longer exists. */
  removeFor(type: LinkableType, id: string): void {
    this.db.run('DELETE FROM links WHERE (from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?)', [type, id, type, id]);
  }
}

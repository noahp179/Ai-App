import { DateTime } from 'luxon';
import { z } from 'zod';
import type { Task, TaskList, TaskPriority, TaskQuery } from '../shared/types';
import type { Db } from './db/database';
import { bool } from './db/database';
import { type Clock, NotFoundError, UserError, cleanLine, newId } from './util';

interface TaskRow {
  id: string;
  list_id: string | null;
  parent_id: string | null;
  title: string;
  notes: string;
  done: number;
  priority: number;
  due_at: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const isoOrNull = z
  .string()
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
  .nullable();

const TaskInput = z.object({
  title: z.string().max(500),
  listId: z.string().max(64).nullable().optional(),
  parentId: z.string().max(64).nullable().optional(),
  notes: z.string().max(20_000).optional(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  dueAt: isoOrNull.optional(),
});
const TaskPatch = TaskInput.partial().extend({ done: z.boolean().optional() });

function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    listId: r.list_id,
    parentId: r.parent_id,
    title: r.title,
    notes: r.notes,
    done: bool(r.done),
    priority: r.priority as TaskPriority,
    dueAt: r.due_at,
    completedAt: r.completed_at,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class TasksService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly zone: () => string,
  ) {}

  private now(): string {
    return this.clock.now().toISOString();
  }

  private row(id: string): TaskRow {
    const r = this.db.get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That task');
    return r;
  }

  lists(): TaskList[] {
    return this.db
      .all<{ id: string; name: string; created_at: string; open_count: number }>(
        `SELECT l.*, (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id AND t.done = 0 AND t.parent_id IS NULL) AS open_count
         FROM task_lists l ORDER BY l.sort_order, l.created_at`,
      )
      .map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, openCount: r.open_count }));
  }

  createList(name: string): TaskList {
    const clean = cleanLine(String(name ?? ''), 100);
    if (!clean) throw new UserError('List name cannot be empty.');
    const id = newId();
    const createdAt = this.now();
    const order = (this.db.get<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM task_lists')?.m ?? 0) + 1;
    this.db.run('INSERT INTO task_lists (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)', [id, clean, order, createdAt]);
    return { id, name: clean, createdAt, openCount: 0 };
  }

  renameList(id: string, name: string): void {
    const clean = cleanLine(String(name ?? ''), 100);
    if (!clean) throw new UserError('List name cannot be empty.');
    if (this.db.run('UPDATE task_lists SET name = ? WHERE id = ?', [clean, id]).changes === 0) throw new NotFoundError('That list');
  }

  deleteList(id: string): void {
    if (this.db.run('DELETE FROM task_lists WHERE id = ?', [id]).changes === 0) throw new NotFoundError('That list');
  }

  /** Top-level tasks with their subtasks (checklist items) nested. */
  list(query: TaskQuery = {}): Task[] {
    const where: string[] = ['t.parent_id IS NULL'];
    const params: (string | number)[] = [];
    const sel = query.listId ?? 'all';
    const zone = this.zone();
    const endOfToday = DateTime.fromJSDate(this.clock.now()).setZone(zone).endOf('day').toUTC().toISO()!;
    if (sel === 'inbox') where.push('t.list_id IS NULL');
    else if (sel === 'today') {
      where.push('t.due_at IS NOT NULL AND t.due_at <= ?');
      params.push(endOfToday);
    } else if (sel === 'upcoming') {
      where.push('t.due_at IS NOT NULL AND t.due_at > ?');
      params.push(endOfToday);
    } else if (sel !== 'all' && sel !== null) {
      where.push('t.list_id = ?');
      params.push(sel);
    }
    if (!query.includeDone) where.push('t.done = 0');
    if (query.search?.trim()) {
      where.push('(t.title LIKE ? OR t.notes LIKE ?)');
      const like = `%${query.search.trim().replace(/[%_]/g, '')}%`;
      params.push(like, like);
    }
    const order = sel === 'today' || sel === 'upcoming' ? 't.done, t.due_at, t.priority DESC' : 't.done, t.sort_order, t.created_at';
    const top = this.db.all<TaskRow>(`SELECT t.* FROM tasks t WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 2000`, params).map(toTask);
    if (top.length === 0) return top;
    const subs = this.db.all<TaskRow>(
      `SELECT * FROM tasks WHERE parent_id IN (${top.map(() => '?').join(',')}) ORDER BY sort_order, created_at`,
      top.map((t) => t.id),
    );
    const byParent = new Map<string, Task[]>();
    for (const s of subs.map(toTask)) {
      const arr = byParent.get(s.parentId!) ?? [];
      arr.push(s);
      byParent.set(s.parentId!, arr);
    }
    return top.map((t) => ({ ...t, subtasks: byParent.get(t.id) ?? [] }));
  }

  get(id: string): Task {
    const t = toTask(this.row(id));
    t.subtasks = this.db.all<TaskRow>('SELECT * FROM tasks WHERE parent_id = ? ORDER BY sort_order, created_at', [id]).map(toTask);
    return t;
  }

  create(input: unknown): Task {
    const data = TaskInput.parse(input);
    const title = cleanLine(data.title, 500);
    if (!title) throw new UserError('Task title cannot be empty.');
    if (data.listId && !this.db.get('SELECT 1 FROM task_lists WHERE id = ?', [data.listId])) throw new NotFoundError('That list');
    let listId = data.listId ?? null;
    if (data.parentId) {
      const parent = this.row(data.parentId);
      if (parent.parent_id) throw new UserError('Checklist items cannot have their own checklist.');
      listId = parent.list_id;
    }
    const id = newId();
    const now = this.now();
    const order = (this.db.get<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM tasks')?.m ?? 0) + 1;
    this.db.run(
      `INSERT INTO tasks (id, list_id, parent_id, title, notes, done, priority, due_at, completed_at, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?, ?)`,
      [id, listId, data.parentId ?? null, title, data.notes ?? '', data.priority ?? 0, data.dueAt ? new Date(data.dueAt).toISOString() : null, order, now, now],
    );
    return this.get(id);
  }

  update(id: string, patch: unknown): Task {
    const data = TaskPatch.parse(patch);
    const cur = this.row(id);
    if (data.title !== undefined && !cleanLine(data.title, 500)) throw new UserError('Task title cannot be empty.');
    if (data.listId && !this.db.get('SELECT 1 FROM task_lists WHERE id = ?', [data.listId])) throw new NotFoundError('That list');
    const done = data.done ?? bool(cur.done);
    const completedAt = done ? (cur.completed_at ?? this.now()) : null;
    this.db.tx(() => {
      this.db.run(
        `UPDATE tasks SET title = ?, notes = ?, priority = ?, due_at = ?, list_id = ?, done = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
        [
          data.title !== undefined ? cleanLine(data.title, 500) : cur.title,
          data.notes ?? cur.notes,
          data.priority ?? cur.priority,
          data.dueAt !== undefined ? (data.dueAt ? new Date(data.dueAt).toISOString() : null) : cur.due_at,
          data.listId !== undefined ? data.listId : cur.list_id,
          done,
          completedAt,
          this.now(),
          id,
        ],
      );
      if (data.listId !== undefined) this.db.run('UPDATE tasks SET list_id = ? WHERE parent_id = ?', [data.listId, id]);
    });
    return this.get(id);
  }

  toggle(id: string, done: boolean): Task {
    return this.update(id, { done });
  }

  delete(id: string): void {
    this.row(id);
    this.db.tx(() => {
      this.db.run("DELETE FROM links WHERE (from_type = 'task' AND from_id = ?) OR (to_type = 'task' AND to_id = ?)", [id, id]);
      this.db.run('DELETE FROM tasks WHERE id = ?', [id]);
    });
  }

  /** Moves a task to sit between two neighbours (either may be null). */
  move(id: string, beforeId: string | null, afterId: string | null): void {
    this.row(id);
    const order = (x: string | null) => (x ? this.row(x).sort_order : null);
    const a = order(afterId);
    const b = order(beforeId);
    let next: number;
    if (a !== null && b !== null) next = (a + b) / 2;
    else if (a !== null) next = a + 1;
    else if (b !== null) next = b - 1;
    else return;
    this.db.run('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?', [next, this.now(), id]);
  }

  clearCompleted(listId: string | null): number {
    return listId
      ? this.db.run('DELETE FROM tasks WHERE done = 1 AND list_id = ? AND parent_id IS NULL', [listId]).changes
      : this.db.run('DELETE FROM tasks WHERE done = 1 AND list_id IS NULL AND parent_id IS NULL').changes;
  }

  /** Open tasks due in [from, to). Used by the reminder scheduler. */
  dueBetween(fromIso: string, toIso: string): Task[] {
    return this.db
      .all<TaskRow>('SELECT * FROM tasks WHERE done = 0 AND due_at IS NOT NULL AND due_at >= ? AND due_at < ? ORDER BY due_at', [fromIso, toIso])
      .map(toTask);
  }

  counts(): { open: number; dueToday: number; overdue: number; doneToday: number } {
    const zone = this.zone();
    const now = DateTime.fromJSDate(this.clock.now()).setZone(zone);
    const start = now.startOf('day').toUTC().toISO()!;
    const end = now.endOf('day').toUTC().toISO()!;
    const nowIso = this.now();
    const one = (sql: string, p: string[] = []) => this.db.get<{ n: number }>(sql, p)?.n ?? 0;
    return {
      open: one('SELECT COUNT(*) AS n FROM tasks WHERE done = 0 AND parent_id IS NULL'),
      dueToday: one('SELECT COUNT(*) AS n FROM tasks WHERE done = 0 AND due_at >= ? AND due_at <= ?', [nowIso, end]),
      overdue: one('SELECT COUNT(*) AS n FROM tasks WHERE done = 0 AND due_at < ?', [nowIso]),
      doneToday: one('SELECT COUNT(*) AS n FROM tasks WHERE done = 1 AND completed_at >= ?', [start]),
    };
  }
}

import { LEARNING_TOPICS, loadCatalog, topicLabel } from '../shared/learning';
import type { Settings } from '../shared/settings';
import type {
  LearningOverview,
  LearningPath,
  LearningPathView,
  LearningQuery,
  LearningRecommendation,
  LearningResource,
  LearningResourceView,
  ResourceProgress,
  ResourceStatus,
  SearchHit,
} from '../shared/types';
import type { Db } from './db/database';
import { bool } from './db/database';
import { type Clock, NotFoundError, UserError } from './util';

interface Row {
  resource_id: string;
  saved: number;
  status: ResourceStatus;
  notes: string;
  started_at: string | null;
  completed_at: string | null;
  last_opened_at: string | null;
  updated_at: string;
}

const toProgress = (r: Row): ResourceProgress => ({
  resourceId: r.resource_id,
  saved: bool(r.saved),
  status: r.status,
  notes: r.notes,
  startedAt: r.started_at,
  completedAt: r.completed_at,
  lastOpenedAt: r.last_opened_at,
  updatedAt: r.updated_at,
});

const STATUSES: ResourceStatus[] = ['not_started', 'in_progress', 'completed'];
const STOP_WORDS = new Set(['about', 'with', 'from', 'that', 'this', 'what', 'your', 'help', 'write', 'make', 'into', 'have', 'need', 'using', 'conversation', 'untitled', 'please', 'question', 'questions', 'some', 'more', 'how', 'why', 'when', 'where', 'which', 'learn', 'learning']);
const cleanTitle = (t: string) => (t.length > 60 ? `${t.slice(0, 59)}…` : t);
const LEVELS = { beginner: 0, intermediate: 1, advanced: 2 } as const;

/**
 * The free learning hub: a bundled, link-checked catalog plus the user's own progress and notes.
 * Recommendations only use the signals the privacy settings allow.
 */
export class LearningService {
  private readonly items: LearningResource[];
  private readonly byId: Map<string, LearningResource>;
  private readonly pathList: LearningPath[];
  readonly checkedOn: string | null;

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly settings: () => Settings,
    /** Titles of recent AI conversations; only read when the user allows it (privacy.useConversationsForPersonalization). */
    private readonly conversationTitles: () => string[] = () => [],
    catalog = loadCatalog(),
  ) {
    this.items = catalog.resources;
    this.pathList = catalog.paths;
    this.checkedOn = catalog.checkedOn;
    this.byId = new Map(this.items.map((r) => [r.id, r]));
  }

  private resource(id: string): LearningResource {
    const r = this.byId.get(id);
    if (!r) throw new NotFoundError('That resource');
    return r;
  }

  private progressMap(): Map<string, ResourceProgress> {
    return new Map(this.db.all<Row>('SELECT * FROM learning_progress').map((r) => [r.resource_id, toProgress(r)]));
  }

  title(id: string): string | null {
    return this.byId.get(id)?.title ?? null;
  }

  get(id: string): LearningResourceView {
    const r = this.resource(id);
    const row = this.db.get<Row>('SELECT * FROM learning_progress WHERE resource_id = ?', [id]);
    return { ...r, progress: row ? toProgress(row) : null };
  }

  resources(q: LearningQuery = {}): LearningResourceView[] {
    const progress = this.progressMap();
    const terms = (q.search ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
    const out: { view: LearningResourceView; score: number }[] = [];
    for (const r of this.items) {
      const p = progress.get(r.id) ?? null;
      if (q.topic && q.topic !== 'any' && !r.topics.includes(q.topic)) continue;
      if (q.level && q.level !== 'any' && r.level !== q.level) continue;
      if (q.type && q.type !== 'any' && r.type !== q.type) continue;
      if (q.registration && q.registration !== 'any' && r.registration !== q.registration) continue;
      if (q.savedOnly && !p?.saved) continue;
      if (q.status && q.status !== 'any' && (p?.status ?? 'not_started') !== q.status) continue;
      let score = 0;
      if (terms.length) {
        const title = r.title.toLowerCase();
        const hay = `${r.publisher} ${r.summary} ${r.topics.map(topicLabel).join(' ')} ${r.type} ${p?.notes ?? ''}`.toLowerCase();
        let all = true;
        for (const t of terms) {
          if (title.includes(t)) score += 3;
          else if (hay.includes(t)) score += 1;
          else all = false;
        }
        if (!all) continue;
      }
      out.push({ view: { ...r, progress: p }, score });
    }
    if (terms.length) out.sort((a, b) => b.score - a.score);
    return out.map((o) => o.view);
  }

  private pathView(p: LearningPath, progress: Map<string, ResourceProgress>): LearningPathView {
    const states = p.steps.map((s) => progress.get(s.resourceId)?.status ?? 'not_started');
    const next = p.steps.find((_, i) => states[i] !== 'completed');
    return {
      ...p,
      total: p.steps.length,
      completed: states.filter((s) => s === 'completed').length,
      started: states.some((s) => s !== 'not_started'),
      nextResourceId: next?.resourceId ?? null,
    };
  }

  paths(): LearningPathView[] {
    const progress = this.progressMap();
    return this.pathList.map((p) => this.pathView(p, progress));
  }

  path(id: string): LearningPathView & { resources: LearningResourceView[] } {
    const p = this.pathList.find((x) => x.id === id);
    if (!p) throw new NotFoundError('That learning path');
    const progress = this.progressMap();
    return { ...this.pathView(p, progress), resources: p.steps.map((s) => ({ ...this.resource(s.resourceId), progress: progress.get(s.resourceId) ?? null })) };
  }

  private upsert(id: string, patch: (cur: ResourceProgress | null, now: string) => Partial<ResourceProgress>): ResourceProgress {
    this.resource(id);
    const now = this.clock.now().toISOString();
    const row = this.db.get<Row>('SELECT * FROM learning_progress WHERE resource_id = ?', [id]);
    const cur = row ? toProgress(row) : null;
    const next: ResourceProgress = {
      resourceId: id,
      saved: false,
      status: 'not_started',
      notes: '',
      startedAt: null,
      completedAt: null,
      lastOpenedAt: null,
      ...cur,
      ...patch(cur, now),
      updatedAt: now,
    };
    this.db.run(
      `INSERT INTO learning_progress (resource_id, saved, status, notes, started_at, completed_at, last_opened_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(resource_id) DO UPDATE SET saved = excluded.saved, status = excluded.status, notes = excluded.notes, started_at = excluded.started_at,
         completed_at = excluded.completed_at, last_opened_at = excluded.last_opened_at, updated_at = excluded.updated_at`,
      [id, next.saved ? 1 : 0, next.status, next.notes, next.startedAt, next.completedAt, next.lastOpenedAt, next.updatedAt],
    );
    return next;
  }

  setSaved(id: string, saved: boolean): ResourceProgress {
    return this.upsert(id, () => ({ saved }));
  }

  /** Status is only ever set by the user; opening a link does not mark anything as started or done. */
  setStatus(id: string, status: ResourceStatus): ResourceProgress {
    if (!STATUSES.includes(status)) throw new UserError('Unknown status.');
    return this.upsert(id, (cur, now) => ({
      status,
      startedAt: status === 'not_started' ? null : (cur?.startedAt ?? now),
      completedAt: status === 'completed' ? (cur?.completedAt ?? now) : null,
    }));
  }

  setNotes(id: string, notes: string): ResourceProgress {
    if (typeof notes !== 'string' || notes.length > 20_000) throw new UserError('Notes are too long (20,000 characters at most).');
    return this.upsert(id, () => ({ notes }));
  }

  markOpened(id: string): ResourceProgress {
    return this.upsert(id, (_cur, now) => ({ lastOpenedAt: now }));
  }

  url(id: string): string {
    return this.resource(id).url;
  }

  /**
   * Suggestions, each with the reason it was chosen. Goals and level are explicit settings; progress is only
   * used when "use my activity" is on. With personalization off everyone gets the same starting points.
   */
  recommendations(limit = 6): { personalized: boolean; items: LearningRecommendation[] } {
    const s = this.settings();
    const out: LearningRecommendation[] = [];
    const seen = new Set<string>();
    const add = (resourceId: string | null, reason: string, pathId: string | null) => {
      if (!resourceId || seen.has(resourceId) || out.length >= limit) return;
      seen.add(resourceId);
      out.push({ resourceId, reason, pathId });
    };
    if (!s.privacy.personalization) {
      const start = this.paths().find((p) => p.id === 'ai-fundamentals');
      for (const st of start?.steps.slice(0, limit) ?? []) add(st.resourceId, 'A good place to start', 'ai-fundamentals');
      return { personalized: false, items: out };
    }
    const progress = s.privacy.useActivityForPersonalization ? this.progressMap() : new Map<string, ResourceProgress>();
    const paths = this.pathList.map((p) => this.pathView(p, progress));
    if (s.privacy.useActivityForPersonalization) {
      const recent = [...progress.values()].filter((p) => p.status === 'in_progress').sort((a, b) => (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt));
      for (const p of recent.slice(0, 2)) add(p.resourceId, 'You started this', null);
      for (const p of paths.filter((x) => x.started && x.nextResourceId)) add(p.nextResourceId, `Next step in “${p.title}”`, p.id);
    }
    if (s.privacy.useConversationsForPersonalization) {
      // Matched locally against resource titles and topics; nothing is sent anywhere.
      let found = 0;
      for (const title of this.conversationTitles().slice(0, 15)) {
        if (found >= 2) break;
        const words = (title.toLowerCase().match(/[\p{L}][\p{L}-]{3,}/gu) ?? []).filter((w) => !STOP_WORDS.has(w));
        for (const w of words) {
          const hit = this.items.find(
            (r) => !seen.has(r.id) && progress.get(r.id)?.status !== 'completed' && (r.title.toLowerCase().split(/[^\p{L}]+/u).includes(w) || r.topics.some((t) => topicLabel(t).toLowerCase().split(/[^\p{L}]+/u).includes(w))),
          );
          if (hit) {
            add(hit.id, `Related to your AI conversation “${cleanTitle(title)}”`, null);
            found++;
            break;
          }
        }
      }
    }
    const level = s.learning.preferredLevel;
    for (const goal of s.learning.goals) {
      const p = paths.find((x) => x.id === goal);
      if (!p) continue;
      const states = progress;
      const fit = p.steps.find((st) => states.get(st.resourceId)?.status !== 'completed' && (level === 'any' || LEVELS[this.resource(st.resourceId).level] <= LEVELS[level]));
      add(fit?.resourceId ?? p.nextResourceId, `Matches your goal “${p.title}”`, p.id);
    }
    if (!out.length) {
      for (const st of paths.find((p) => p.id === 'ai-fundamentals')?.steps ?? []) add(st.resourceId, 'A good place to start', 'ai-fundamentals');
    }
    return { personalized: true, items: out };
  }

  overview(): LearningOverview {
    const c = this.db.get<{ saved: number; prog: number; done: number }>(
      `SELECT COALESCE(SUM(saved), 0) AS saved, COALESCE(SUM(status = 'in_progress'), 0) AS prog, COALESCE(SUM(status = 'completed'), 0) AS done FROM learning_progress`,
    )!;
    return {
      checkedOn: this.checkedOn,
      total: this.items.length,
      verified: this.items.filter((r) => r.linkCheck?.ok).length,
      topics: LEARNING_TOPICS.map((t) => ({ id: t.id, label: t.label, count: this.items.filter((r) => r.topics.includes(t.id)).length })),
      saved: c.saved,
      inProgress: c.prog,
      completed: c.done,
    };
  }

  /** Global-search provider. */
  search(q: string, limit: number): SearchHit[] {
    if (!q.trim()) return [];
    return this.resources({ search: q })
      .slice(0, limit)
      .map((r) => ({ type: 'resource', id: r.id, title: r.title, snippet: `${r.publisher} — ${r.summary}`.slice(0, 200), updatedAt: r.progress?.updatedAt ?? null }));
  }

  exportData(): { format: string; version: 1; exportedAt: string; progress: (ResourceProgress & { title: string; url: string })[] } {
    return {
      format: 'flowcompanion.learning',
      version: 1,
      exportedAt: this.clock.now().toISOString(),
      progress: [...this.progressMap().values()].filter((p) => this.byId.has(p.resourceId)).map((p) => ({ ...p, title: this.title(p.resourceId)!, url: this.url(p.resourceId) })),
    };
  }

  /** Removes progress, saved items and notes, and links to resources. Returns the number of resources affected. */
  deleteData(): number {
    return this.db.tx(() => {
      const n = this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM learning_progress')!.n;
      this.db.run('DELETE FROM learning_progress');
      this.db.run("DELETE FROM links WHERE from_type = 'resource' OR to_type = 'resource'");
      return n;
    });
  }
}

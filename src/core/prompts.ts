import { z } from 'zod';
import { PROMPT_CATEGORIES } from '../shared/prompts';
import type { Prompt, PromptVersion, ProviderLabel } from '../shared/types';
import type { Db } from './db/database';
import { bool, json } from './db/database';
import { type Clock, NotFoundError, UserError, cleanLine, cleanTags, newId } from './util';

interface Row {
  id: string;
  title: string;
  description: string;
  body: string;
  category: string;
  tags: string;
  favorite: number;
  providers: string;
  version: number;
  origin: Prompt['origin'];
  listing_id: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  use_count: number;
}

const toPrompt = (r: Row): Prompt => ({
  id: r.id,
  title: r.title,
  description: r.description,
  body: r.body,
  category: r.category,
  tags: json<string[]>(r.tags, []),
  favorite: bool(r.favorite),
  providers: json<ProviderLabel[]>(r.providers, ['any']),
  version: r.version,
  origin: r.origin,
  listingId: r.listing_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  lastUsedAt: r.last_used_at,
  useCount: r.use_count,
});

const Providers = z.array(z.enum(['any', 'openai', 'anthropic', 'gemini', 'local'])).max(5);
export const PromptInput = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  body: z.string().max(50_000).optional(),
  category: z.string().max(40).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
  providers: Providers.optional(),
  favorite: z.boolean().optional(),
});
export type PromptInputData = z.input<typeof PromptInput>;

const ExportDoc = z.object({
  format: z.literal('flowcompanion.prompts'),
  version: z.literal(1),
  prompts: z
    .array(
      z.object({
        title: z.string().max(200),
        description: z.string().max(2000).default(''),
        body: z.string().min(1).max(50_000),
        category: z.string().max(40).default('general'),
        tags: z.array(z.string().max(60)).max(30).default([]),
        providers: Providers.default(['any']),
        favorite: z.boolean().default(false),
      }),
    )
    .max(5000),
});

function category(c: string | undefined): string {
  const v = cleanLine(c ?? 'general', 40).toLowerCase();
  return v || 'general';
}
function providers(p: ProviderLabel[] | undefined): ProviderLabel[] {
  const set: ProviderLabel[] = [...new Set<ProviderLabel>(p ?? ['any'])];
  if (!set.length || set.includes('any')) return ['any'];
  return set;
}

/** The local prompt library: prompts with versions, variables and provider labels. */
export class PromptsService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  private row(id: string): Row {
    const r = this.db.get<Row>('SELECT * FROM prompts WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That prompt');
    return r;
  }

  get(id: string): Prompt {
    return toPrompt(this.row(id));
  }

  list(q: { search?: string; category?: string; favorite?: boolean; provider?: ProviderLabel; sort?: 'recent' | 'used' | 'title' } = {}): Prompt[] {
    const where: string[] = ['1 = 1'];
    const p: (string | number)[] = [];
    if (q.search?.trim()) {
      const like = `%${q.search.trim().replace(/[%_\\]/g, '')}%`;
      where.push('(title LIKE ? OR description LIKE ? OR body LIKE ? OR tags LIKE ?)');
      p.push(like, like, like, like);
    }
    if (q.category && q.category !== 'all') {
      where.push('category = ?');
      p.push(q.category);
    }
    if (q.favorite) where.push('favorite = 1');
    if (q.provider && q.provider !== 'any') {
      where.push(`(EXISTS (SELECT 1 FROM json_each(prompts.providers) WHERE value = ? OR value = 'any'))`);
      p.push(q.provider);
    }
    const order = q.sort === 'title' ? 'title COLLATE NOCASE ASC' : q.sort === 'used' ? 'use_count DESC, last_used_at DESC' : 'updated_at DESC';
    return this.db.all<Row>(`SELECT * FROM prompts WHERE ${where.join(' AND ')} ORDER BY favorite DESC, ${order}`, p).map(toPrompt);
  }

  categories(): { category: string; count: number }[] {
    const counts = new Map(this.db.all<{ category: string; n: number }>('SELECT category, COUNT(*) AS n FROM prompts GROUP BY category').map((r) => [r.category, r.n]));
    const all = new Set<string>([...PROMPT_CATEGORIES, ...counts.keys()]);
    return [...all].map((c) => ({ category: c, count: counts.get(c) ?? 0 }));
  }

  create(input: PromptInputData, origin: { origin: Prompt['origin']; listingId: string | null } = { origin: 'user', listingId: null }): Prompt {
    const d = PromptInput.parse(input ?? {});
    const body = d.body ?? '';
    if (!body.trim()) throw new UserError('Write the prompt text first.');
    const id = newId();
    const now = this.clock.now().toISOString();
    const title = cleanLine(d.title ?? '', 200) || cleanLine(body, 60) || 'Untitled prompt';
    this.db.tx(() => {
      this.db.run(
        `INSERT INTO prompts (id, title, description, body, category, tags, favorite, providers, version, origin, listing_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [id, title, d.description?.trim() ?? '', body, category(d.category), JSON.stringify(cleanTags(d.tags ?? [])), d.favorite ? 1 : 0, JSON.stringify(providers(d.providers)), origin.origin, origin.listingId, now, now],
      );
      this.db.run('INSERT INTO prompt_versions (id, prompt_id, version, title, body, note, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)', [newId(), id, title, body, 'Created', now]);
    });
    return this.get(id);
  }

  /** Changing the title or text creates a new version; other fields update in place. */
  update(id: string, patch: PromptInputData, note = ''): Prompt {
    const cur = this.get(id);
    const d = PromptInput.parse(patch ?? {});
    const title = d.title !== undefined ? cleanLine(d.title, 200) || cur.title : cur.title;
    const body = d.body !== undefined ? d.body : cur.body;
    if (!body.trim()) throw new UserError('A prompt cannot be empty.');
    const contentChanged = title !== cur.title || body !== cur.body;
    const version = contentChanged ? cur.version + 1 : cur.version;
    const now = this.clock.now().toISOString();
    this.db.tx(() => {
      this.db.run(
        `UPDATE prompts SET title = ?, description = ?, body = ?, category = ?, tags = ?, favorite = ?, providers = ?, version = ?, updated_at = ? WHERE id = ?`,
        [
          title,
          d.description !== undefined ? d.description.trim() : cur.description,
          body,
          d.category !== undefined ? category(d.category) : cur.category,
          JSON.stringify(d.tags !== undefined ? cleanTags(d.tags) : cur.tags),
          (d.favorite ?? cur.favorite) ? 1 : 0,
          JSON.stringify(d.providers !== undefined ? providers(d.providers) : cur.providers),
          version,
          now,
          id,
        ],
      );
      if (contentChanged) {
        this.db.run('INSERT INTO prompt_versions (id, prompt_id, version, title, body, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId(), id, version, title, body, cleanLine(note, 200), now]);
      }
    });
    return this.get(id);
  }

  setFavorite(id: string, favorite: boolean): Prompt {
    this.row(id);
    this.db.run('UPDATE prompts SET favorite = ? WHERE id = ?', [favorite ? 1 : 0, id]);
    return this.get(id);
  }

  versions(id: string): PromptVersion[] {
    this.row(id);
    return this.db
      .all<{ id: string; prompt_id: string; version: number; title: string; body: string; note: string; created_at: string }>('SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version DESC', [id])
      .map((v) => ({ id: v.id, promptId: v.prompt_id, version: v.version, title: v.title, body: v.body, note: v.note, createdAt: v.created_at }));
  }

  /** Restoring never deletes history: it creates a new version with the old content. */
  restoreVersion(id: string, version: number): Prompt {
    const v = this.versions(id).find((x) => x.version === version);
    if (!v) throw new NotFoundError(`Version ${version}`);
    return this.update(id, { title: v.title, body: v.body }, `Restored from version ${version}`);
  }

  duplicate(id: string): Prompt {
    const p = this.get(id);
    return this.create({ title: `${p.title} (copy)`, description: p.description, body: p.body, category: p.category, tags: p.tags, providers: p.providers });
  }

  delete(id: string): void {
    this.row(id);
    this.db.run('DELETE FROM prompts WHERE id = ?', [id]);
    this.db.run("DELETE FROM links WHERE (from_type = 'prompt' AND from_id = ?) OR (to_type = 'prompt' AND to_id = ?)", [id, id]);
  }

  recordUse(id: string): Prompt {
    this.row(id);
    this.db.run('UPDATE prompts SET use_count = use_count + 1, last_used_at = ? WHERE id = ?', [this.clock.now().toISOString(), id]);
    return this.get(id);
  }

  exportDoc(ids?: string[]): { format: 'flowcompanion.prompts'; version: 1; exportedAt: string; prompts: object[] } {
    const list = ids?.length ? ids.map((i) => this.get(i)) : this.list({ sort: 'title' });
    return {
      format: 'flowcompanion.prompts',
      version: 1,
      exportedAt: this.clock.now().toISOString(),
      prompts: list.map((p) => ({ title: p.title, description: p.description, body: p.body, category: p.category, tags: p.tags, providers: p.providers, favorite: p.favorite })),
    };
  }

  /** Imports a prompts export. Prompts with the same title and text as an existing one are skipped. */
  importDoc(raw: unknown): { imported: number; skipped: number; errors: string[] } {
    const parsed = ExportDoc.safeParse(raw);
    if (!parsed.success) return { imported: 0, skipped: 0, errors: ['This is not a FlowCompanion prompts file (format "flowcompanion.prompts", version 1).'] };
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    this.db.tx(() => {
      for (const p of parsed.data.prompts) {
        if (this.db.get('SELECT 1 FROM prompts WHERE title = ? AND body = ?', [cleanLine(p.title, 200), p.body])) {
          skipped++;
          continue;
        }
        try {
          this.create(p);
          imported++;
        } catch (err) {
          errors.push(`${p.title || 'Untitled'}: ${(err as Error).message}`);
        }
      }
    });
    return { imported, skipped, errors };
  }
}

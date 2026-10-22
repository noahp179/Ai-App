import type { Db } from './database';

export interface Migration {
  version: number;
  name: string;
  up: (db: Db) => void;
}

/** Keeps the shared search index in sync with one source table. */
function searchTriggers(opts: {
  table: string;
  type: string;
  title: string;
  body: string;
  parent?: string;
  where?: string;
}): string {
  const { table, type, title, body } = opts;
  const parent = opts.parent ?? "''";
  const cond = (row: 'new' | 'old') => (opts.where ? `WHEN ${opts.where.replaceAll('$row', row)}` : '');
  const sub = (expr: string, row: 'new' | 'old') => expr.replaceAll('$row', row);
  return `
    CREATE TRIGGER ${table}_search_ai AFTER INSERT ON ${table} ${cond('new')} BEGIN
      INSERT INTO search_index(type, ref_id, parent_id, title, body)
      VALUES ('${type}', new.id, ${sub(parent, 'new')}, ${sub(title, 'new')}, ${sub(body, 'new')});
    END;
    CREATE TRIGGER ${table}_search_au AFTER UPDATE ON ${table} BEGIN
      DELETE FROM search_index WHERE type = '${type}' AND ref_id = old.id;
      INSERT INTO search_index(type, ref_id, parent_id, title, body)
      SELECT '${type}', new.id, ${sub(parent, 'new')}, ${sub(title, 'new')}, ${sub(body, 'new')}
      ${opts.where ? `WHERE ${sub(opts.where, 'new')}` : ''};
    END;
    CREATE TRIGGER ${table}_search_ad AFTER DELETE ON ${table} BEGIN
      DELETE FROM search_index WHERE type = '${type}' AND ref_id = old.id;
    END;`;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'core key-value store and search index',
    up: (db) =>
      db.exec(`
        CREATE TABLE kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE secrets (
          name TEXT PRIMARY KEY,
          value BLOB NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE search_index USING fts5(
          type UNINDEXED, ref_id UNINDEXED, parent_id UNINDEXED, title, body,
          tokenize = 'unicode61 remove_diacritics 2'
        );
      `),
  },
  {
    version: 2,
    name: 'notes, folders, tags, drafts and links',
    up: (db) =>
      db.exec(`
        CREATE TABLE folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          format TEXT NOT NULL DEFAULT 'markdown' CHECK (format IN ('markdown', 'plain')),
          folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
          pinned INTEGER NOT NULL DEFAULT 0,
          favorite INTEGER NOT NULL DEFAULT 0,
          archived_at TEXT,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX notes_updated ON notes(updated_at);
        CREATE INDEX notes_folder ON notes(folder_id);
        CREATE TABLE note_tags (
          note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          tag TEXT NOT NULL,
          PRIMARY KEY (note_id, tag)
        );
        CREATE INDEX note_tags_tag ON note_tags(tag);
        CREATE TABLE note_drafts (
          note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          base_revision INTEGER NOT NULL,
          saved_at TEXT NOT NULL
        );
        CREATE TABLE links (
          id TEXT PRIMARY KEY,
          from_type TEXT NOT NULL,
          from_id TEXT NOT NULL,
          to_type TEXT NOT NULL,
          to_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE (from_type, from_id, to_type, to_id)
        );
        CREATE INDEX links_to ON links(to_type, to_id);
        ${searchTriggers({ table: 'notes', type: 'note', title: '$row.title', body: '$row.body', where: '$row.deleted_at IS NULL' })}
      `),
  },
  {
    version: 3,
    name: 'tasks, bookmarks, time tracking and focus sessions',
    up: (db) =>
      db.exec(`
        CREATE TABLE task_lists (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          list_id TEXT REFERENCES task_lists(id) ON DELETE CASCADE,
          parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          done INTEGER NOT NULL DEFAULT 0,
          priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
          due_at TEXT,
          completed_at TEXT,
          sort_order REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX tasks_list ON tasks(list_id, done);
        CREATE INDEX tasks_parent ON tasks(parent_id);
        CREATE INDEX tasks_due ON tasks(due_at);
        CREATE TABLE bookmarks (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          tags TEXT NOT NULL DEFAULT '[]',
          queue TEXT NOT NULL DEFAULT 'none' CHECK (queue IN ('none', 'unread', 'read')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          read_at TEXT
        );
        CREATE TABLE time_entries (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE focus_sessions (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (kind IN ('focus', 'short_break', 'long_break')),
          planned_minutes INTEGER NOT NULL,
          started_at TEXT NOT NULL,
          ends_at TEXT NOT NULL,
          paused_at TEXT,
          remaining_ms INTEGER,
          ended_at TEXT,
          completed INTEGER NOT NULL DEFAULT 0,
          label TEXT NOT NULL DEFAULT ''
        );
        ${searchTriggers({ table: 'tasks', type: 'task', title: '$row.title', body: '$row.notes' })}
        ${searchTriggers({ table: 'bookmarks', type: 'bookmark', title: '$row.title', body: "$row.url || ' ' || $row.description" })}
      `),
  },
  {
    version: 4,
    name: 'AI providers, conversations, messages and task status',
    up: (db) =>
      db.exec(`
        CREATE TABLE providers (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          name TEXT NOT NULL,
          base_url TEXT NOT NULL,
          default_model TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          key_storage TEXT NOT NULL DEFAULT 'none',
          last_status TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
          model TEXT,
          system_prompt TEXT NOT NULL DEFAULT '',
          archived_at TEXT,
          ephemeral INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX conversations_updated ON conversations(updated_at);
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          provider_id TEXT,
          provider_kind TEXT,
          model TEXT,
          usage TEXT,
          created_at TEXT NOT NULL,
          finished_at TEXT
        );
        CREATE INDEX messages_conversation ON messages(conversation_id, created_at);
        CREATE TABLE ai_tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          source TEXT NOT NULL,
          state TEXT NOT NULL,
          confidence TEXT NOT NULL,
          ref_type TEXT,
          ref_id TEXT,
          started_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          finished_at TEXT,
          timeout_at TEXT,
          notified_at TEXT,
          detail TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX ai_tasks_state ON ai_tasks(state);
        ${searchTriggers({ table: 'conversations', type: 'conversation', title: '$row.title', body: "''" })}
        ${searchTriggers({
          table: 'messages',
          type: 'message',
          title: "''",
          body: '$row.content',
          parent: '$row.conversation_id',
          where: "$row.status IN ('complete', 'canceled')",
        })}
      `),
  },
  {
    version: 5,
    name: 'calendar events, reminders and notifications',
    up: (db) =>
      db.exec(`
        CREATE TABLE events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT '',
          meeting_url TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'general',
          all_day INTEGER NOT NULL DEFAULT 0,
          start TEXT NOT NULL,
          end TEXT NOT NULL,
          time_zone TEXT NOT NULL,
          recurrence TEXT,
          overrides TEXT NOT NULL DEFAULT '[]',
          checklist TEXT NOT NULL DEFAULT '[]',
          reminders TEXT NOT NULL DEFAULT '[]',
          source TEXT NOT NULL DEFAULT 'local',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX events_start ON events(start);
        CREATE TABLE reminders (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL DEFAULT '',
          fire_at TEXT NOT NULL,
          ref_type TEXT,
          ref_id TEXT,
          snoozed_until TEXT,
          completed_at TEXT,
          dismissed_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX reminders_fire ON reminders(fire_at);
        CREATE TABLE notification_log (
          dedupe_key TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          fired_at TEXT NOT NULL,
          delivery TEXT NOT NULL
        );
        CREATE TABLE inbox (
          id TEXT PRIMARY KEY,
          dedupe_key TEXT NOT NULL UNIQUE,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          read_at TEXT,
          delivery TEXT NOT NULL,
          action TEXT,
          snoozable INTEGER NOT NULL DEFAULT 0,
          source_ref TEXT
        );
        CREATE INDEX inbox_created ON inbox(created_at);
        ${searchTriggers({ table: 'events', type: 'event', title: '$row.title', body: "$row.notes || ' ' || $row.location" })}
      `),
  },
  {
    version: 6,
    name: 'news feed sources, items and alerts',
    up: (db) =>
      db.exec(`
        CREATE TABLE feed_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          url TEXT NOT NULL UNIQUE,
          site_url TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          blocked INTEGER NOT NULL DEFAULT 0,
          builtin INTEGER NOT NULL DEFAULT 0,
          etag TEXT,
          last_modified TEXT,
          last_fetched_at TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE feed_items (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
          guid TEXT NOT NULL,
          url TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '',
          author TEXT NOT NULL DEFAULT '',
          published_at TEXT,
          fetched_at TEXT NOT NULL,
          read_at TEXT,
          saved_at TEXT,
          url_key TEXT NOT NULL,
          title_key TEXT NOT NULL,
          duplicate_of TEXT,
          UNIQUE (source_id, guid)
        );
        CREATE INDEX feed_items_published ON feed_items(published_at);
        CREATE INDEX feed_items_url_key ON feed_items(url_key);
        CREATE INDEX feed_items_title_key ON feed_items(title_key);
        CREATE TABLE feed_alerts (
          id TEXT PRIMARY KEY,
          keyword TEXT NOT NULL UNIQUE,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );
        ${searchTriggers({ table: 'feed_items', type: 'article', title: '$row.title', body: '$row.summary', where: '$row.saved_at IS NOT NULL' })}
      `),
  },
  {
    version: 7,
    name: 'games and learning progress',
    up: (db) =>
      db.exec(`
        CREATE TABLE game_scores (
          id TEXT PRIMARY KEY,
          game TEXT NOT NULL,
          score REAL NOT NULL,
          detail TEXT NOT NULL DEFAULT '{}',
          played_at TEXT NOT NULL
        );
        CREATE INDEX game_scores_game ON game_scores(game, played_at);
        CREATE TABLE game_state (
          game TEXT PRIMARY KEY,
          state TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE learning_progress (
          resource_id TEXT PRIMARY KEY,
          saved INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'not_started',
          notes TEXT NOT NULL DEFAULT '',
          started_at TEXT,
          completed_at TEXT,
          last_opened_at TEXT,
          updated_at TEXT NOT NULL
        );
      `),
  },
  {
    version: 8,
    name: 'prompt library and marketplace',
    up: (db) =>
      db.exec(`
        CREATE TABLE prompts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general',
          tags TEXT NOT NULL DEFAULT '[]',
          favorite INTEGER NOT NULL DEFAULT 0,
          providers TEXT NOT NULL DEFAULT '["any"]',
          version INTEGER NOT NULL DEFAULT 1,
          origin TEXT NOT NULL DEFAULT 'user',
          listing_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_used_at TEXT,
          use_count INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE prompt_versions (
          id TEXT PRIMARY KEY,
          prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          UNIQUE (prompt_id, version)
        );
        CREATE TABLE creator_profiles (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          bio TEXT NOT NULL DEFAULT '',
          website TEXT NOT NULL DEFAULT '',
          is_self INTEGER NOT NULL DEFAULT 0,
          origin TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE listings (
          id TEXT PRIMARY KEY,
          origin TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '',
          preview TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'general',
          tags TEXT NOT NULL DEFAULT '[]',
          providers TEXT NOT NULL DEFAULT '["any"]',
          creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
          pricing_type TEXT NOT NULL DEFAULT 'free' CHECK (pricing_type IN ('free', 'paid')),
          price_cents INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'USD',
          trial_eligible INTEGER NOT NULL DEFAULT 0,
          version TEXT NOT NULL DEFAULT '1.0.0',
          status TEXT NOT NULL DEFAULT 'draft',
          moderation_note TEXT,
          demo INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          published_at TEXT
        );
        CREATE INDEX listings_status ON listings(status, origin);
        CREATE TABLE listing_versions (
          id TEXT PRIMARY KEY,
          listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
          version TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          changelog TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        );
        CREATE TABLE reviews (
          id TEXT PRIMARY KEY,
          listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
          author_name TEXT NOT NULL,
          rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
          text TEXT NOT NULL DEFAULT '',
          verified INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE abuse_reports (
          id TEXT PRIMARY KEY,
          listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
          reason TEXT NOT NULL,
          details TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'open',
          created_at TEXT NOT NULL
        );
        CREATE TABLE entitlements (
          id TEXT PRIMARY KEY,
          listing_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('free', 'trial', 'purchase')),
          starts_at TEXT NOT NULL,
          expires_at TEXT,
          authority TEXT NOT NULL CHECK (authority IN ('local', 'server')),
          revoked_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX entitlements_listing ON entitlements(listing_id);
        CREATE TABLE listing_events (
          id TEXT PRIMARY KEY,
          listing_id TEXT NOT NULL,
          event TEXT NOT NULL,
          at TEXT NOT NULL
        );
        CREATE INDEX listing_events_listing ON listing_events(listing_id, event);
        ${searchTriggers({ table: 'prompts', type: 'prompt', title: '$row.title', body: "$row.description || ' ' || $row.body" })}
      `),
  },
  {
    version: 9,
    name: 'supervised study sessions',
    up: (db) =>
      db.exec(`
        CREATE TABLE study_sessions (
          id TEXT PRIMARY KEY,
          goal TEXT NOT NULL DEFAULT '',
          allowed_modules TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ends_at TEXT NOT NULL,
          ended_at TEXT,
          ended_by TEXT
        );
      `),
  },
  {
    version: 10,
    name: 'provider options and raw assistant payloads for faithful history replay',
    up: (db) =>
      db.exec(`
        ALTER TABLE providers ADD COLUMN options TEXT NOT NULL DEFAULT '{}';
        ALTER TABLE messages ADD COLUMN provider_payload TEXT;
        ALTER TABLE messages ADD COLUMN served_model TEXT;
        ALTER TABLE messages ADD COLUMN notices TEXT NOT NULL DEFAULT '[]';
      `),
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export class MigrationError extends Error {
  constructor(
    readonly version: number,
    readonly migrationName: string,
    readonly reason: unknown,
  ) {
    super(`Migration ${version} (${migrationName}) failed: ${reason instanceof Error ? reason.message : String(reason)}`);
    this.name = 'MigrationError';
  }
}

/**
 * Applies pending migrations, each in its own transaction, so a failure leaves
 * the database at the last good version.
 */
export function migrate(db: Db, migrations: Migration[] = MIGRATIONS): { from: number; to: number } {
  const from = db.userVersion;
  const latest = migrations.reduce((m, x) => Math.max(m, x.version), 0);
  if (from > latest) {
    throw new Error(
      `This database was created by a newer FlowCompanion (schema ${from}, this build supports ${latest}). Update the app or restore a backup.`,
    );
  }
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version <= db.userVersion) continue;
    try {
      db.tx(() => {
        m.up(db);
        db.userVersion = m.version;
      });
    } catch (err) {
      throw new MigrationError(m.version, m.name, err);
    }
  }
  return { from, to: db.userVersion };
}

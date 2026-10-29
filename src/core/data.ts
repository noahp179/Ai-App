import type { Db } from './db/database';

/** What each table holds, in plain words, for the privacy screen. */
export const DATA_INVENTORY: { table: string; label: string; description: string }[] = [
  { table: 'notes', label: 'Notes', description: 'Titles, text, tags and folders you write.' },
  { table: 'note_drafts', label: 'Unsaved note drafts', description: 'Recovery copies of edits not yet saved; removed once saved.' },
  { table: 'tasks', label: 'Tasks', description: 'Tasks, checklists and due dates.' },
  { table: 'bookmarks', label: 'Bookmarks and reading queue', description: 'Links you saved. Pages are never fetched.' },
  { table: 'time_entries', label: 'Time tracking', description: 'Activities and their start/end times.' },
  { table: 'focus_sessions', label: 'Focus sessions', description: 'Focus timer history.' },
  { table: 'events', label: 'Calendar events', description: 'Events, recurrence, reminders and checklists.' },
  { table: 'reminders', label: 'Reminders', description: 'Reminders you set and their snooze state.' },
  { table: 'inbox', label: 'Notifications', description: 'Delivered notifications.' },
  { table: 'notification_log', label: 'Notification history', description: 'Which reminders already fired, so they never repeat. Pruned after 30 days.' },
  { table: 'providers', label: 'AI providers', description: 'Provider names and addresses. API keys are stored separately (OS secure storage).' },
  { table: 'conversations', label: 'AI conversations', description: 'Conversation titles and settings.' },
  { table: 'messages', label: 'AI messages', description: 'What you sent to and received from AI providers.' },
  { table: 'ai_tasks', label: 'AI task status', description: 'State of AI requests and timers.' },
  { table: 'feed_sources', label: 'News sources', description: 'Feeds you follow or blocked.' },
  { table: 'feed_items', label: 'News items', description: 'Cached headlines and short previews from your sources.' },
  { table: 'feed_alerts', label: 'News alerts', description: 'Keywords that trigger an alert.' },
  { table: 'game_scores', label: 'Game scores', description: 'Your results in the mini-games.' },
  { table: 'learning_progress', label: 'Learning progress', description: 'Saved resources, status and your notes on them.' },
  { table: 'prompts', label: 'Prompt library', description: 'Prompts you saved and their versions.' },
  { table: 'listings', label: 'Marketplace listings', description: 'Bundled listings and your own drafts.' },
  { table: 'entitlements', label: 'Trials and access', description: 'Trials you started and their expiry.' },
  { table: 'study_sessions', label: 'Supervised study sessions', description: 'Sessions started under parental learning controls.' },
  { table: 'students', label: 'Student Learning profiles', description: 'Name or nickname, grade, courses and preferences of each student profile. PINs are stored only as hashes.' },
  { table: 'study_lessons', label: 'Student lessons', description: 'Lessons started in Student Learning, with answers and progress through each one.' },
  { table: 'study_quizzes', label: 'Student quizzes', description: 'Practice, quizzes and reviews, with answers.' },
  { table: 'study_evidence', label: 'Student answers (progress evidence)', description: 'Each marked answer, used to work out progress on an expectation.' },
  { table: 'study_plans', label: 'Study plans', description: 'Proposed and approved study plans.' },
  { table: 'study_tutor_messages', label: 'AI tutor messages', description: 'What a student sent to and received from the AI tutor.' },
  { table: 'secrets', label: 'Encrypted secrets', description: 'API keys and pairing tokens, encrypted by the OS. Never exported.' },
];

const EXCLUDED = new Set(['secrets', 'kv', 'search_index']);
/**
 * Student Learning records are left out of "Export everything": a profile can have its own PIN, and the app-wide
 * export is open to anyone using this computer. Each student exports their own records from inside their profile.
 * (study_sessions belongs to Parental Learning Controls, not to a student profile.)
 */
export const isStudentTable = (t: string): boolean => t === 'students' || (t.startsWith('study_') && t !== 'study_sessions');

export class DataService {
  constructor(private readonly db: Db) {}

  inventory(): { table: string; label: string; description: string; rows: number }[] {
    const existing = new Set(this.db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name));
    return DATA_INVENTORY.filter((d) => existing.has(d.table)).map((d) => ({
      ...d,
      rows: this.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${d.table}`)?.n ?? 0,
    }));
  }

  /** Every user table except secrets, as plain JSON. */
  exportAll(now: Date, appVersion: string): Record<string, unknown> {
    const tables = this.db
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_index%' ORDER BY name")
      .map((r) => r.name)
      .filter((t) => !EXCLUDED.has(t) && !isStudentTable(t));
    const out: Record<string, unknown[]> = {};
    for (const t of tables) {
      out[t] = this.db.all(`SELECT * FROM ${t}`).map((row) => {
        const r: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row as Record<string, unknown>)) r[k] = v instanceof Uint8Array ? null : v;
        return r;
      });
    }
    const settings = this.db.get<{ value: string }>("SELECT value FROM kv WHERE key = 'settings'");
    return {
      format: 'flowcompanion.export',
      version: 1,
      appVersion,
      schemaVersion: this.db.userVersion,
      exportedAt: now.toISOString(),
      note: 'API keys and other secrets are never included. Student Learning profiles are not included either: each student exports their own records from Student Learning → Learning settings.',
      settings: settings ? JSON.parse(settings.value) : null,
      tables: out,
    };
  }
}

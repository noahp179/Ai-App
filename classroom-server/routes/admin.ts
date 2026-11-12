import { randomCode } from '../../src/core/passwords';
import { SchoolSettingsPatch, SchoolSettingsSchema, type AuditEntryDto, type SchoolAdminDto, type UsageRowDto } from '../../src/shared/classroom/protocol';
import { HttpError, type ClassRow, type S } from '../core';
import { encryptText } from '../crypto';
import { deleteClass } from './classes';

/** How long a class is kept after it ends: its end date, or a year after it was created when none was set. */
export function classEnd(cls: Pick<ClassRow, 'ends_on' | 'created_at'>): Date {
  return cls.ends_on ? new Date(`${cls.ends_on}T23:59:59Z`) : new Date(Date.parse(cls.created_at) + 365 * 86_400_000);
}

/** Deletes classes whose retention period has ended, with their materials, attempts, chats and files. */
export async function purgeExpired(s: S): Promise<{ classes: number; files: number }> {
  let classes = 0;
  let files = 0;
  const now = s.clock.now().getTime();
  for (const cls of s.db.all<ClassRow>('SELECT * FROM classes')) {
    const keepDays = s.settings(cls.school_id).retentionDays;
    if (classEnd(cls).getTime() + keepDays * 86_400_000 > now) continue;
    const r = await deleteClass(s, cls.id);
    s.audit(null, cls.school_id, 'class.purged', cls.name, `Retention period ended (${keepDays} days after the class ended). ${r.files} stored files deleted.`);
    classes++;
    files += r.files;
  }
  // Student accounts that no longer belong to any class and have no work left are removed too.
  s.db.run(`DELETE FROM users WHERE role = 'student' AND NOT EXISTS (SELECT 1 FROM class_members m WHERE m.user_id = users.id) AND NOT EXISTS (SELECT 1 FROM attempts t WHERE t.user_id = users.id) AND created_at < ?`, [new Date(now - 30 * 86_400_000).toISOString()]);
  return { classes, files };
}

export function registerAdmin(s: S): void {
  const { db } = s;
  let lastPurge = 0;
  s.sweeps.push(async () => {
    // Retention is checked hourly.
    if (Date.now() - lastPurge < 3600_000) return;
    lastPurge = Date.now();
    await purgeExpired(s);
  });

  const view = (schoolId: string): SchoolAdminDto => {
    const sc = db.get<{ id: string; name: string; ai_key_hint: string | null; under13_by: string | null; under13_at: string | null; invite_code: string | null; invite_expires: string | null }>('SELECT * FROM schools WHERE id = ?', [schoolId])!;
    const source = s.aiKeySource(schoolId);
    const b = s.budget(schoolId);
    return {
      school: { id: sc.id, name: sc.name },
      settings: s.settings(schoolId),
      aiKey: { set: source !== 'none', hint: source === 'school' ? sc.ai_key_hint : null, source },
      under13Consent: sc.under13_at && sc.under13_by ? { confirmedBy: sc.under13_by, at: sc.under13_at } : null,
      teacherInvite: sc.invite_code && sc.invite_expires && sc.invite_expires > s.now() ? { code: sc.invite_code, expiresAt: sc.invite_expires } : null,
      usage: { month: b.month, cost: b.cost, inputTokens: b.inputTokens, outputTokens: b.outputTokens, requests: b.requests, budget: b.budget, state: b.state },
      teachers: db
        .all<{ id: string; display_name: string; login: string; role: 'admin' | 'teacher'; n: number }>(
          `SELECT u.id, u.display_name, u.login, u.role, (SELECT COUNT(*) FROM class_members m WHERE m.user_id = u.id AND m.role != 'student' AND m.status = 'active') AS n FROM users u WHERE u.school_id = ? AND u.role IN ('admin', 'teacher') ORDER BY u.display_name COLLATE NOCASE`,
          [schoolId],
        )
        .map((t) => ({ id: t.id, displayName: t.display_name, login: t.login, role: t.role, classes: t.n })),
    };
  };

  s.route('GET', '/admin/school', (c) => view(s.requireRole(c, 'admin').school_id));

  s.route('PATCH', '/admin/school', (c) => {
    const u = s.requireRole(c, 'admin');
    const { aiKey, under13Consent, ...patch } = s.parse(SchoolSettingsPatch, c.body);
    const next = SchoolSettingsSchema.parse({ ...s.settings(u.school_id), ...patch });
    db.run('UPDATE schools SET settings = ? WHERE id = ?', [JSON.stringify(next), u.school_id]);
    const changed = Object.keys(patch);
    if (aiKey !== undefined) {
      const k = aiKey?.trim() || null;
      if (k && k.length < 20) throw new HttpError(400, 'invalid_request', 'That does not look like an API key.');
      // The key is stored encrypted and never sent back to any client; only its last four characters are shown.
      db.run('UPDATE schools SET ai_key_enc = ?, ai_key_hint = ? WHERE id = ?', [k ? encryptText(s.key, k) : null, k ? `…${k.slice(-4)}` : null, u.school_id]);
      changed.push(k ? 'AI key set' : 'AI key removed');
    }
    if (under13Consent !== undefined) {
      db.run('UPDATE schools SET under13_by = ?, under13_at = ? WHERE id = ?', [under13Consent ? u.display_name : null, under13Consent ? s.now() : null, u.school_id]);
      changed.push(under13Consent ? 'confirmed consent for students under 13' : 'withdrew the under-13 consent confirmation');
    }
    if (changed.length) s.audit(u, u.school_id, 'school.settings', 'School settings', changed.join(', '));
    return view(u.school_id);
  });

  s.route('POST', '/admin/teacher-invite', (c) => {
    const u = s.requireRole(c, 'admin');
    db.run('UPDATE schools SET invite_code = ?, invite_expires = ? WHERE id = ?', [randomCode(3), new Date(s.clock.now().getTime() + 14 * 86_400_000).toISOString(), u.school_id]);
    s.audit(u, u.school_id, 'teacher.invite', 'Teacher invite code created');
    return view(u.school_id);
  });

  s.route('GET', '/admin/audit', (c) => {
    const u = s.requireRole(c, 'admin');
    const limit = Math.min(500, Math.max(1, Number(c.url.searchParams.get('limit')) || 200));
    const action = c.url.searchParams.get('action');
    return db
      .all<{ id: string; at: string; actor: string; action: string; target: string; detail: string }>(`SELECT id, at, actor, action, target, detail FROM audit_log WHERE school_id = ? ${action ? 'AND action = ?' : ''} ORDER BY at DESC, rowid DESC LIMIT ?`, action ? [u.school_id, action, limit] : [u.school_id, limit])
      .map((r): AuditEntryDto => r);
  });

  s.route('GET', '/admin/usage', (c) => {
    const u = s.requireRole(c, 'admin');
    const month = s.now().slice(0, 7);
    return db
      .all<{ class_id: string | null; class_name: string | null; assessment_id: string | null; title: string | null; n: number; i: number; o: number; cost: number }>(
        `SELECT x.class_id, c.name AS class_name, x.assessment_id, a.title, COUNT(*) AS n, SUM(x.input_tokens + x.cache_read + x.cache_write) AS i, SUM(x.output_tokens) AS o, SUM(x.cost) AS cost
         FROM ai_usage x LEFT JOIN classes c ON c.id = x.class_id LEFT JOIN assessments a ON a.id = x.assessment_id
         WHERE x.school_id = ? AND x.at >= ? GROUP BY x.class_id, x.assessment_id ORDER BY cost DESC`,
        [u.school_id, `${month}-01`],
      )
      .map((r): UsageRowDto => ({ classId: r.class_id ?? '', className: r.class_name ?? '(deleted class)', assessmentId: r.assessment_id, assessmentTitle: r.title, requests: r.n, inputTokens: r.i, outputTokens: r.o, cost: Math.round(r.cost * 10000) / 10000 }));
  });

  /** Runs the retention check now. */
  s.route('POST', '/admin/purge', async (c) => {
    const u = s.requireRole(c, 'admin');
    const r = await purgeExpired(s);
    s.audit(u, u.school_id, 'retention.run', 'Retention check', `${r.classes} classes deleted`);
    return r;
  });
}

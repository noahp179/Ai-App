import { hashSecret, randomCode, verifySecret } from '../../src/core/passwords';
import { parseCsv } from '../../src/shared/classroom/csv';
import { AccommodationBody, ClassBody, CoTeacherBody, JoinClassBody, JoinCodeBody, MemberBody, RosterBody, type ClassDto, type JoinCodeDto, type MemberDto, type RosterResult, type RosterRow, type SessionDto } from '../../src/shared/classroom/protocol';
import { HttpError, forbidden, notFound, type ClassRow, type Ctx, type S, type UserRow } from '../core';

interface Accounts {
  createUser(schoolId: string, role: UserRow['role'], displayName: string, login: string, password: string): UserRow;
  session(c: Ctx, user: UserRow): SessionDto;
  checkLock(login: string): void;
  fail(login: string): void;
}

export function registerClasses(s: S, accounts: Accounts): void {
  const { db } = s;

  const classDto = (cls: ClassRow, role: ClassDto['myRole']): ClassDto => {
    const n = db.get<{ a: number | null; p: number | null }>(`SELECT SUM(status = 'active') AS a, SUM(status = 'pending') AS p FROM class_members WHERE class_id = ? AND role = 'student'`, [cls.id])!;
    return {
      id: cls.id,
      name: cls.name,
      section: cls.section,
      schoolYear: cls.school_year,
      courseId: cls.course_id,
      courseLabel: cls.course_label,
      endsOn: cls.ends_on,
      mayIncludeUnder13: cls.under13 === 1,
      archived: !!cls.archived_at,
      myRole: role,
      students: n.a ?? 0,
      pending: role === 'student' ? 0 : (n.p ?? 0),
    };
  };

  /** Students under 13 need the school to have confirmed it holds consent. */
  const checkUnder13 = (cls: ClassRow) => {
    if (cls.under13 !== 1) return;
    const school = db.get<{ under13_at: string | null }>('SELECT under13_at FROM schools WHERE id = ?', [cls.school_id])!;
    if (!school.under13_at) throw forbidden('This class may include students under 13. The school’s administrator has to confirm that the school has consent before students can join. Tell your teacher.');
  };

  s.route('GET', '/classes', (c) => {
    const u = s.requireUser(c);
    return db
      .all<ClassRow & { role: ClassDto['myRole'] }>(`SELECT c.*, m.role FROM classes c JOIN class_members m ON m.class_id = c.id WHERE m.user_id = ? AND m.status = 'active' ORDER BY c.archived_at IS NOT NULL, c.created_at DESC`, [u.id])
      .map((r) => classDto(r, r.role));
  });

  s.route('POST', '/classes', (c) => {
    const u = s.requireRole(c, 'teacher', 'admin');
    const b = s.parse(ClassBody, c.body);
    const id = s.newId();
    db.tx(() => {
      db.run('INSERT INTO classes (id, school_id, name, section, school_year, course_id, course_label, ends_on, under13, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        id,
        u.school_id,
        b.name,
        b.section,
        b.schoolYear,
        b.courseId,
        b.courseLabel,
        b.endsOn,
        b.mayIncludeUnder13,
        u.id,
        s.now(),
      ]);
      db.run(`INSERT INTO class_members (class_id, user_id, role, status, joined_at) VALUES (?, ?, 'teacher', 'active', ?)`, [id, u.id, s.now()]);
    });
    s.audit(u, u.school_id, 'class.created', b.name);
    return classDto(db.get<ClassRow>('SELECT * FROM classes WHERE id = ?', [id])!, 'teacher');
  });

  s.route('GET', '/classes/:id', (c, [id]) => {
    const { cls, role } = s.classFor(c, id!);
    return classDto(cls, role);
  });

  s.route('PATCH', '/classes/:id', (c, [id]) => {
    const { cls, role } = s.classFor(c, id!, 'teacher');
    const b = s.parse(ClassBody.partial(), c.body);
    db.run('UPDATE classes SET name = ?, section = ?, school_year = ?, course_id = ?, course_label = ?, ends_on = ?, under13 = ? WHERE id = ?', [
      b.name ?? cls.name,
      b.section ?? cls.section,
      b.schoolYear ?? cls.school_year,
      b.courseId !== undefined ? b.courseId : cls.course_id,
      b.courseLabel !== undefined ? b.courseLabel : cls.course_label,
      b.endsOn !== undefined ? b.endsOn : cls.ends_on,
      b.mayIncludeUnder13 ?? cls.under13 === 1,
      cls.id,
    ]);
    return classDto(db.get<ClassRow>('SELECT * FROM classes WHERE id = ?', [cls.id])!, role);
  });

  s.route('POST', '/classes/:id/archive', (c, [id]) => {
    const { cls, role } = s.classFor(c, id!, 'teacher');
    const archive = (c.body as { archived?: boolean })?.archived !== false;
    db.run('UPDATE classes SET archived_at = ? WHERE id = ?', [archive ? s.now() : null, cls.id]);
    return classDto(db.get<ClassRow>('SELECT * FROM classes WHERE id = ?', [cls.id])!, role);
  });

  s.route('DELETE', '/classes/:id', async (c, [id]) => {
    const { cls, role, user } = s.classFor(c, id!, 'teacher');
    if (role !== 'teacher') throw forbidden('Co-teachers cannot delete a class.');
    await deleteClass(s, cls.id);
    s.audit(user, cls.school_id, 'class.deleted', cls.name);
    return { ok: true };
  });

  // ─────────── Enrolment ───────────

  s.route('GET', '/classes/:id/members', (c, [id]) => {
    s.classFor(c, id!, 'teacher');
    return db
      .all<{ user_id: string; display_name: string; login: string; role: MemberDto['role']; status: MemberDto['status']; joined_at: string }>(
        `SELECT m.user_id, u.display_name, u.login, m.role, m.status, m.joined_at FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? AND m.status != 'removed' ORDER BY m.role = 'student', u.display_name COLLATE NOCASE`,
        [id!],
      )
      .map((r): MemberDto => ({ userId: r.user_id, displayName: r.display_name, login: r.login, role: r.role, status: r.status, joinedAt: r.joined_at }));
  });

  s.route('POST', '/classes/:id/members/:user', (c, [id, userId]) => {
    const { cls, user } = s.classFor(c, id!, 'teacher');
    const b = s.parse(MemberBody, c.body);
    const m = db.get<{ role: string; status: string }>('SELECT role, status FROM class_members WHERE class_id = ? AND user_id = ?', [cls.id, userId!]);
    if (!m) throw notFound('That person');
    if (b.action === 'approve') db.run(`UPDATE class_members SET status = 'active' WHERE class_id = ? AND user_id = ? AND status = 'pending'`, [cls.id, userId!]);
    else if (b.action === 'remove') {
      if (m.role === 'teacher') throw forbidden('The class’s teacher cannot be removed.');
      // Past submissions stay for the teacher until the retention period ends.
      db.run(`UPDATE class_members SET status = 'removed' WHERE class_id = ? AND user_id = ?`, [cls.id, userId!]);
      s.audit(user, cls.school_id, 'member.removed', `${cls.name}: ${userId}`);
    }
    return { ok: true };
  });

  s.route('POST', '/classes/:id/co-teachers', (c, [id]) => {
    const { cls, role, user } = s.classFor(c, id!, 'teacher');
    if (role !== 'teacher') throw forbidden('Only the class’s teacher can invite a co-teacher.');
    const b = s.parse(CoTeacherBody, c.body);
    const t = db.get<UserRow>(`SELECT * FROM users WHERE login = ? AND school_id = ? AND role IN ('teacher', 'admin')`, [b.login, cls.school_id]);
    if (!t) throw notFound('A teacher with that email or username at your school');
    db.run(`INSERT INTO class_members (class_id, user_id, role, status, joined_at) VALUES (?, ?, 'co_teacher', 'active', ?) ON CONFLICT(class_id, user_id) DO UPDATE SET role = 'co_teacher', status = 'active'`, [cls.id, t.id, s.now()]);
    s.audit(user, cls.school_id, 'co_teacher.added', `${cls.name}: ${t.login}`);
    return { ok: true };
  });

  s.route('GET', '/classes/:id/join-code', (c, [id]) => {
    s.classFor(c, id!, 'teacher');
    const r = db.get<{ code: string; expires_at: string; require_approval: number }>('SELECT * FROM join_codes WHERE class_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1', [id!, s.now()]);
    return r ? ({ code: r.code, expiresAt: r.expires_at, requireApproval: r.require_approval === 1 } satisfies JoinCodeDto) : null;
  });

  /** Makes a new code and retires the old ones. */
  s.route('POST', '/classes/:id/join-code', (c, [id]) => {
    const { cls } = s.classFor(c, id!, 'teacher');
    const b = s.parse(JoinCodeBody, c.body);
    const code = randomCode(2);
    const expiresAt = new Date(s.clock.now().getTime() + b.expiresInDays * 86_400_000).toISOString();
    db.tx(() => {
      db.run('DELETE FROM join_codes WHERE class_id = ?', [cls.id]);
      db.run('INSERT INTO join_codes (code, class_id, expires_at, require_approval, created_at) VALUES (?, ?, ?, ?, ?)', [code, cls.id, expiresAt, b.requireApproval, s.now()]);
    });
    return { code, expiresAt, requireApproval: b.requireApproval } satisfies JoinCodeDto;
  });

  s.route('DELETE', '/classes/:id/join-code', (c, [id]) => {
    s.classFor(c, id!, 'teacher');
    db.run('DELETE FROM join_codes WHERE class_id = ?', [id!]);
    return { ok: true };
  });

  /** What a join code leads to, shown before someone creates an account. */
  s.route('GET', '/join/:code', (_c, [code]) => {
    const r = db.get<{ name: string; school: string; expires_at: string }>('SELECT c.name, sc.name AS school, j.expires_at FROM join_codes j JOIN classes c ON c.id = j.class_id JOIN schools sc ON sc.id = c.school_id WHERE j.code = ?', [code!.toUpperCase()]);
    if (!r || r.expires_at <= s.now()) throw new HttpError(404, 'code_invalid', 'That class code is not valid or has expired. Ask your teacher for a new one.');
    return { className: r.name, schoolName: r.school };
  });

  s.route(
    'POST',
    '/join',
    (c) => {
      const b = s.parse(JoinClassBody, c.body);
      const j = db.get<{ class_id: string; expires_at: string; require_approval: number }>('SELECT * FROM join_codes WHERE code = ?', [b.code.toUpperCase()]);
      if (!j || j.expires_at <= s.now()) throw new HttpError(404, 'code_invalid', 'That class code is not valid or has expired. Ask your teacher for a new one.');
      const cls = db.get<ClassRow>('SELECT * FROM classes WHERE id = ?', [j.class_id])!;
      if (cls.archived_at) throw forbidden('That class is archived.');
      let user = c.user;
      let created = false;
      if (!user) {
        if (!b.login || !b.password) throw new HttpError(400, 'invalid_request', 'Enter an email or username and a password.');
        accounts.checkLock(b.login);
        const existing = db.get<UserRow>('SELECT * FROM users WHERE login = ?', [b.login]);
        if (existing) {
          if (!verifySecret(b.password, existing.password_hash)) {
            accounts.fail(b.login);
            throw new HttpError(401, 'bad_credentials', 'That email or username already has an account, and the password does not match it.');
          }
          user = existing;
        } else {
          if (!b.displayName) throw new HttpError(400, 'invalid_request', 'Enter your name.');
          checkUnder13(cls);
          user = accounts.createUser(cls.school_id, 'student', b.displayName, b.login, b.password);
          created = true;
        }
      }
      if (user.school_id !== cls.school_id) throw forbidden('That class belongs to a different school.');
      checkUnder13(cls);
      const m = db.get<{ status: string; role: string }>('SELECT status, role FROM class_members WHERE class_id = ? AND user_id = ?', [cls.id, user.id]);
      const status = j.require_approval === 1 ? 'pending' : 'active';
      if (!m) db.run(`INSERT INTO class_members (class_id, user_id, role, status, joined_at) VALUES (?, ?, 'student', ?, ?)`, [cls.id, user.id, status, s.now()]);
      else if (m.status === 'removed') throw forbidden('You were removed from this class. Ask your teacher to add you again.');
      const finalStatus = m?.status ?? status;
      const out = { classId: cls.id, className: cls.name, status: finalStatus as 'active' | 'pending' };
      return c.user ? out : { ...out, session: accounts.session(c, user), created };
    },
    { auth: true },
  );

  /** CSV roster: preview first (nothing is created), then commit. Columns: name, email or username. */
  s.route('POST', '/classes/:id/roster', (c, [id]) => {
    const { cls, user } = s.classFor(c, id!, 'teacher');
    const b = s.parse(RosterBody, c.body);
    const lines = parseCsv(b.csv);
    const header = lines[0]?.map((h) => h.trim().toLowerCase()) ?? [];
    const hasHeader = header.some((h) => /^(name|student|display ?name)$/.test(h)) || header.some((h) => /^(email|username|login)/.test(h));
    const nameCol = hasHeader ? Math.max(0, header.findIndex((h) => /name|student/.test(h))) : 0;
    const loginCol = hasHeader ? header.findIndex((h) => /email|username|login/.test(h)) : 1;
    const seen = new Set<string>();
    const rows: RosterRow[] = lines.slice(hasHeader ? 1 : 0).map((cols, i) => {
      const displayName = (cols[nameCol] ?? '').trim();
      const login = (cols[loginCol] ?? '').trim();
      let error: string | null = null;
      if (loginCol < 0) error = 'No "email" or "username" column was found.';
      else if (!displayName) error = 'Name is missing.';
      else if (displayName.length > 60) error = 'Name is longer than 60 characters.';
      else if (!/^[^\s]{3,120}$/.test(login)) error = 'Email or username is missing, has spaces or is shorter than 3 characters.';
      else if (seen.has(login.toLowerCase())) error = 'This email or username appears more than once.';
      seen.add(login.toLowerCase());
      const existing = error ? undefined : db.get<UserRow>('SELECT * FROM users WHERE login = ?', [login]);
      if (existing && existing.school_id !== cls.school_id) error = 'This email or username belongs to an account at another school.';
      else if (existing && existing.role !== 'student') error = 'This email or username belongs to a teacher.';
      return { line: i + (hasHeader ? 2 : 1), displayName, login, error, existing: !!existing };
    });
    if (rows.length > 500) throw new HttpError(400, 'invalid_request', 'A roster can have at most 500 students.');
    const errors = rows.filter((r) => r.error).length;
    const result: RosterResult = { committed: false, rows, created: 0, added: 0, errors };
    if (!b.commit || errors || !rows.length) return result;
    checkUnder13(cls);
    db.tx(() => {
      for (const r of rows) {
        let u = db.get<UserRow>('SELECT * FROM users WHERE login = ?', [r.login]);
        if (!u) {
          r.temporaryPassword = randomCode(3);
          const uid = s.newId();
          db.run(`INSERT INTO users (id, school_id, role, display_name, login, password_hash, created_at) VALUES (?, ?, 'student', ?, ?, ?, ?)`, [uid, cls.school_id, r.displayName, r.login, hashSecret(r.temporaryPassword), s.now()]);
          u = db.get<UserRow>('SELECT * FROM users WHERE id = ?', [uid])!;
          result.created++;
        }
        const before = db.get<{ status: string }>('SELECT status FROM class_members WHERE class_id = ? AND user_id = ?', [cls.id, u.id]);
        db.run(`INSERT INTO class_members (class_id, user_id, role, status, joined_at) VALUES (?, ?, 'student', 'active', ?) ON CONFLICT(class_id, user_id) DO UPDATE SET status = 'active'`, [cls.id, u.id, s.now()]);
        if (before?.status !== 'active') result.added++;
      }
    });
    result.committed = true;
    s.audit(user, cls.school_id, 'roster.imported', cls.name, `${result.created} accounts created, ${result.added} students added`);
    return result;
  });

  // ─────────── Accommodations ───────────

  s.route('GET', '/classes/:id/accommodations', (c, [id]) => {
    s.classFor(c, id!, 'teacher');
    return Object.fromEntries(db.all<{ user_id: string; data: string }>('SELECT user_id, data FROM accommodations WHERE class_id = ?', [id!]).map((r) => [r.user_id, JSON.parse(r.data) as unknown]));
  });

  s.route('PUT', '/classes/:id/accommodations/:user', (c, [id, userId]) => {
    const { cls, user } = s.classFor(c, id!, 'teacher');
    const b = s.parse(AccommodationBody, c.body);
    if (!db.get(`SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ? AND role = 'student'`, [cls.id, userId!])) throw notFound('That student');
    db.run('INSERT INTO accommodations (class_id, user_id, data, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(class_id, user_id) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at', [
      cls.id,
      userId!,
      JSON.stringify(b),
      user.id,
      s.now(),
    ]);
    s.audit(user, cls.school_id, 'accommodation.updated', `${cls.name}: ${userId}`);
    return b;
  });
}

/** Removes a class with everything in it: database rows (by cascade) and stored files. */
export async function deleteClass(s: S, classId: string): Promise<{ files: number }> {
  const ai = s.ai(s.db.get<{ school_id: string }>('SELECT school_id FROM classes WHERE id = ?', [classId])?.school_id ?? '');
  for (const m of s.db.all<{ ai_file_id: string | null }>('SELECT ai_file_id FROM materials WHERE class_id = ? AND ai_file_id IS NOT NULL', [classId])) {
    // Copies held by the AI provider go too. Best effort: the provider may be unreachable.
    if (m.ai_file_id) await ai?.deleteFile?.(m.ai_file_id).catch(() => {});
  }
  const files = await s.storage.deletePrefix(classId);
  s.db.run('DELETE FROM classes WHERE id = ?', [classId]);
  return { files };
}

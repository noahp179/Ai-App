import path from 'node:path';
import { readBundleFile } from '../../src/core/curriculum/bundle';
import { ItemError, promptText, toQuestion } from '../../src/shared/classroom/items';
import { AssessmentBody, AssessmentPatch, DraftItemsBody, ImportItemsBody, ItemBody, ItemPatch, ReorderBody, type AssessmentDto, type AssessmentSettings, type ItemDto } from '../../src/shared/classroom/protocol';
import { courseLabel } from '../../src/shared/curriculum/types';
import { AI_ERROR_MESSAGE, AiProviderError } from '../ai/provider';
import { DraftItemsOutput, draftItemsPrompt } from '../ai/prompts';
import { HttpError, forbidden, json, notFound, type Ctx, type S } from '../core';
import { assessmentFor, itemsOf, phaseOf, settingsOf, type AssessmentRow } from '../lifecycle';

export function registerAssessments(s: S): void {
  const { db } = s;

  const dto = (a: AssessmentRow, role: 'teacher' | 'co_teacher' | 'student', userId: string): AssessmentDto => {
    const items = db.get<{ n: number; p: number | null; u: number | null }>('SELECT COUNT(*) AS n, SUM(points) AS p, SUM(ai_drafted = 1 AND reviewed_by IS NULL) AS u FROM assessment_items WHERE assessment_id = ? AND version = ?', [a.id, a.version])!;
    const base: AssessmentDto = {
      id: a.id,
      classId: a.class_id,
      title: a.title,
      instructions: a.instructions,
      status: a.status,
      phase: phaseOf(a, s.now()),
      version: a.version,
      settings: settingsOf(a),
      materialIds: json<string[]>(a.material_ids, []),
      items: items.n,
      points: items.p ?? 0,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    };
    if (role === 'student') {
      const mine = db.all<{ id: string; status: string; released_at: string | null }>('SELECT id, status, released_at FROM attempts WHERE assessment_id = ? AND user_id = ? ORDER BY number DESC', [a.id, userId]);
      const latest = mine[0];
      const score = latest?.released_at ? db.get<{ t: number | null }>('SELECT SUM(score) AS t FROM grades WHERE attempt_id = ?', [latest.id])!.t : null;
      base.my = { attemptsUsed: mine.length, attemptId: latest?.id ?? null, status: !latest ? 'not_started' : latest.released_at ? 'released' : latest.status === 'submitted' ? 'submitted' : 'in_progress', score };
      // Students do not need the teacher's rubric text for AI use until results are released.
      return base;
    }
    const n = db.get<{ subs: number | null; rel: number | null }>(`SELECT SUM(status = 'submitted') AS subs, SUM(released_at IS NOT NULL) AS rel FROM attempts WHERE assessment_id = ?`, [a.id])!;
    const toGrade = db.get<{ n: number }>(`SELECT COUNT(DISTINCT g.attempt_id) AS n FROM grades g JOIN attempts t ON t.id = g.attempt_id WHERE t.assessment_id = ? AND t.status = 'submitted' AND g.score IS NULL`, [a.id])!.n;
    return { ...base, unreviewedAiItems: items.u ?? 0, submissions: n.subs ?? 0, toGrade, released: n.rel ?? 0 };
  };

  /** Editing questions after students have answered makes a new version; their attempts keep the one they answered. */
  const editableVersion = (a: AssessmentRow): number => {
    if (!db.get('SELECT 1 FROM attempts WHERE assessment_id = ? AND version = ?', [a.id, a.version])) return a.version;
    const next = a.version + 1;
    db.tx(() => {
      db.run(
        `INSERT INTO assessment_items (id, assessment_id, version, position, points, question, long, ai_drafted, reviewed_by, expectation_ids)
         SELECT id, assessment_id, ?, position, points, question, long, ai_drafted, reviewed_by, expectation_ids FROM assessment_items WHERE assessment_id = ? AND version = ?`,
        [next, a.id, a.version],
      );
      db.run('UPDATE assessments SET version = ?, updated_at = ? WHERE id = ?', [next, s.now(), a.id]);
    });
    a.version = next;
    return next;
  };

  const checkMaterials = (classId: string, ids: string[]) => {
    for (const id of ids) if (!db.get('SELECT 1 FROM materials WHERE id = ? AND class_id = ?', [id, classId])) throw new HttpError(400, 'invalid_request', 'One of the attached materials is not in this class.');
  };
  const checkWindow = (st: AssessmentSettings) => {
    if (st.opensAt && st.closesAt && st.closesAt <= st.opensAt) throw new HttpError(400, 'invalid_request', 'The closing time has to be after the opening time.');
  };
  const question = (raw: unknown, id: string, origin: 'authored' | 'ai' = 'authored') => {
    try {
      return toQuestion(raw, id, origin);
    } catch (err) {
      if (err instanceof ItemError) throw new HttpError(400, 'invalid_question', err.message);
      throw err;
    }
  };
  const addItem = (a: AssessmentRow, version: number, q: unknown, points: number, long: boolean, expectationIds: string[], aiDrafted: boolean): string => {
    const id = s.newId().slice(0, 13);
    const pos = (db.get<{ m: number | null }>('SELECT MAX(position) AS m FROM assessment_items WHERE assessment_id = ? AND version = ?', [a.id, version])!.m ?? 0) + 1;
    const qq = question(q, id, aiDrafted ? 'ai' : 'authored');
    db.run('INSERT INTO assessment_items (id, assessment_id, version, position, points, question, long, ai_drafted, reviewed_by, expectation_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)', [
      id,
      a.id,
      version,
      pos,
      points,
      JSON.stringify(qq),
      long && qq.type === 'written',
      aiDrafted,
      JSON.stringify(expectationIds),
    ]);
    return id;
  };
  const touch = (id: string) => db.run('UPDATE assessments SET updated_at = ? WHERE id = ?', [s.now(), id]);

  s.route('GET', '/classes/:id/assessments', (c, [id]) => {
    const { role, user } = s.classFor(c, id!);
    return db
      .all<AssessmentRow>(`SELECT * FROM assessments WHERE class_id = ? ${role === 'student' ? "AND status = 'published'" : ''} ORDER BY created_at DESC`, [id!])
      .map((a) => dto(a, role, user.id));
  });

  s.route('POST', '/classes/:id/assessments', (c, [id]) => {
    const { cls, user, role } = s.classFor(c, id!, 'teacher');
    const b = s.parse(AssessmentBody, c.body);
    checkMaterials(cls.id, b.materialIds);
    checkWindow(b.settings);
    const aid = s.newId();
    db.run(`INSERT INTO assessments (id, class_id, title, instructions, status, version, settings, material_ids, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?, ?)`, [
      aid,
      cls.id,
      b.title,
      b.instructions,
      JSON.stringify(b.settings),
      JSON.stringify(b.materialIds),
      user.id,
      s.now(),
      s.now(),
    ]);
    return dto(db.get<AssessmentRow>('SELECT * FROM assessments WHERE id = ?', [aid])!, role, user.id);
  });

  s.route('GET', '/assessments/:id', (c, [id]) => {
    const { a, role, user } = assessmentFor(s, c, id!);
    return dto(a, role, user.id);
  });

  s.route('PATCH', '/assessments/:id', (c, [id]) => {
    const { a, cls, role, user } = assessmentFor(s, c, id!, 'teacher');
    const b = s.parse(AssessmentPatch, c.body);
    const settings = b.settings ? { ...settingsOf(a), ...b.settings } : settingsOf(a);
    checkWindow(settings);
    if (b.materialIds) checkMaterials(cls.id, b.materialIds);
    db.run('UPDATE assessments SET title = ?, instructions = ?, settings = ?, material_ids = ?, updated_at = ? WHERE id = ?', [b.title ?? a.title, b.instructions ?? a.instructions, JSON.stringify(settings), JSON.stringify(b.materialIds ?? json(a.material_ids, [])), s.now(), a.id]);
    return dto(db.get<AssessmentRow>('SELECT * FROM assessments WHERE id = ?', [a.id])!, role, user.id);
  });

  s.route('DELETE', '/assessments/:id', (c, [id]) => {
    const { a, cls, user } = assessmentFor(s, c, id!, 'teacher');
    db.run('DELETE FROM assessments WHERE id = ?', [a.id]);
    s.audit(user, cls.school_id, 'assessment.deleted', `${cls.name}: ${a.title}`);
    return { ok: true };
  });

  s.route('POST', '/assessments/:id/publish', (c, [id]) => {
    const { a, cls, role, user } = assessmentFor(s, c, id!, 'teacher');
    const publish = (c.body as { publish?: boolean })?.publish !== false;
    if (publish) {
      const items = itemsOf(s, a.id, a.version);
      if (!items.length) throw new HttpError(400, 'no_items', 'Add at least one question before publishing.');
      const waiting = items.filter((i) => !i.reviewed).length;
      // The same rule as the Student Learning assessment builder: nothing drafted by AI reaches students unreviewed.
      if (waiting) throw new HttpError(400, 'unreviewed_items', `${waiting} AI-drafted question${waiting === 1 ? ' needs' : 's need'} to be reviewed (accepted, edited or removed) before publishing.`);
    } else if (db.get(`SELECT 1 FROM attempts WHERE assessment_id = ? AND status = 'in_progress'`, [a.id])) throw new HttpError(409, 'in_progress', 'Students are working on this right now. Close it by setting a closing time instead.');
    db.run('UPDATE assessments SET status = ?, updated_at = ? WHERE id = ?', [publish ? 'published' : 'draft', s.now(), a.id]);
    s.audit(user, cls.school_id, publish ? 'assessment.published' : 'assessment.unpublished', `${cls.name}: ${a.title}`);
    return dto(db.get<AssessmentRow>('SELECT * FROM assessments WHERE id = ?', [a.id])!, role, user.id);
  });

  /** Copies every assessment (as drafts, with their questions; materials are not copied) from another of the teacher's classes. */
  s.route('POST', '/classes/:id/copy-assessments', (c, [id]) => {
    const { cls, user } = s.classFor(c, id!, 'teacher');
    const from = String((c.body as { fromClassId?: string })?.fromClassId ?? '');
    s.classFor(c, from, 'teacher');
    let n = 0;
    db.tx(() => {
      for (const a of db.all<AssessmentRow>('SELECT * FROM assessments WHERE class_id = ?', [from])) {
        const aid = s.newId();
        const st = { ...settingsOf(a), opensAt: null, closesAt: null };
        db.run(`INSERT INTO assessments (id, class_id, title, instructions, status, version, settings, material_ids, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', 1, ?, '[]', ?, ?, ?)`, [aid, cls.id, a.title, a.instructions, JSON.stringify(st), user.id, s.now(), s.now()]);
        db.run(
          `INSERT INTO assessment_items (id, assessment_id, version, position, points, question, long, ai_drafted, reviewed_by, expectation_ids)
           SELECT id, ?, 1, position, points, question, long, ai_drafted, reviewed_by, expectation_ids FROM assessment_items WHERE assessment_id = ? AND version = ?`,
          [aid, a.id, a.version],
        );
        n++;
      }
    });
    return { copied: n };
  });

  // ─────────── Questions ───────────

  s.route('GET', '/assessments/:id/items', (c, [id]) => {
    const { a } = assessmentFor(s, c, id!, 'teacher');
    return itemsOf(s, a.id, a.version);
  });

  s.route('POST', '/assessments/:id/items', (c, [id]) => {
    const { a } = assessmentFor(s, c, id!, 'teacher');
    const b = s.parse(ItemBody, c.body);
    const v = editableVersion(a);
    const itemId = addItem(a, v, b.question, b.points, b.long, b.expectationIds, false);
    touch(a.id);
    return itemsOf(s, a.id, v).find((i) => i.id === itemId)!;
  });

  s.route('PATCH', '/assessments/:id/items/:item', (c, [id, itemId]) => {
    const { a, user } = assessmentFor(s, c, id!, 'teacher');
    const b = s.parse(ItemPatch, c.body);
    const v = editableVersion(a);
    const cur = itemsOf(s, a.id, v).find((i) => i.id === itemId);
    if (!cur) throw notFound('That question');
    const q = b.question ? question(b.question, cur.id, cur.aiDrafted ? 'ai' : 'authored') : cur.question;
    // Editing an AI-drafted question counts as reviewing it; so does accepting it as it is.
    const reviewed = cur.aiDrafted ? (b.reviewed === false ? null : b.reviewed || b.question ? user.id : cur.reviewed ? user.id : null) : null;
    if (reviewed && q.origin === 'ai') q.keyVerified = true;
    db.run('UPDATE assessment_items SET points = ?, question = ?, long = ?, expectation_ids = ?, reviewed_by = ? WHERE assessment_id = ? AND version = ? AND id = ?', [
      b.points ?? cur.points,
      JSON.stringify(q),
      (b.long ?? cur.long) && q.type === 'written',
      JSON.stringify(b.expectationIds ?? cur.expectationIds),
      reviewed,
      a.id,
      v,
      cur.id,
    ]);
    touch(a.id);
    return itemsOf(s, a.id, v).find((i) => i.id === cur.id)!;
  });

  s.route('DELETE', '/assessments/:id/items/:item', (c, [id, itemId]) => {
    const { a } = assessmentFor(s, c, id!, 'teacher');
    const v = editableVersion(a);
    if (!db.run('DELETE FROM assessment_items WHERE assessment_id = ? AND version = ? AND id = ?', [a.id, v, itemId!]).changes) throw notFound('That question');
    itemsOf(s, a.id, v).forEach((it, i) => db.run('UPDATE assessment_items SET position = ? WHERE assessment_id = ? AND version = ? AND id = ?', [i + 1, a.id, v, it.id]));
    touch(a.id);
    return { ok: true };
  });

  s.route('POST', '/assessments/:id/items/reorder', (c, [id]) => {
    const { a } = assessmentFor(s, c, id!, 'teacher');
    const b = s.parse(ReorderBody, c.body);
    const v = editableVersion(a);
    const ids = itemsOf(s, a.id, v).map((i) => i.id);
    if (b.itemIds.length !== ids.length || !ids.every((x) => b.itemIds.includes(x))) throw new HttpError(400, 'invalid_request', 'The list does not match this assessment’s questions.');
    db.tx(() => b.itemIds.forEach((x, i) => db.run('UPDATE assessment_items SET position = ? WHERE assessment_id = ? AND version = ? AND id = ?', [i + 1, a.id, v, x])));
    return itemsOf(s, a.id, v);
  });

  /** Questions from a file: a FlowCompanion assessment export, or a JSON list of questions. */
  s.route('POST', '/assessments/:id/items/import', (c, [id]) => {
    const { a } = assessmentFor(s, c, id!, 'teacher');
    const b = s.parse(ImportItemsBody, c.body);
    let data: unknown;
    try {
      data = JSON.parse(b.json);
    } catch {
      throw new HttpError(400, 'invalid_request', 'That file is not valid JSON.');
    }
    const list: unknown[] = Array.isArray(data) ? data : ((data as { assessment?: { items?: unknown[] }; items?: unknown[] })?.assessment?.items ?? (data as { items?: unknown[] })?.items ?? []);
    if (!list.length) throw new HttpError(400, 'invalid_request', 'No questions were found in that file.');
    if (list.length > 100) throw new HttpError(400, 'invalid_request', 'A file can add at most 100 questions.');
    const v = editableVersion(a);
    const problems: string[] = [];
    let added = 0;
    db.tx(() => {
      list.forEach((raw, i) => {
        const r = raw as { question?: unknown; points?: number; long?: boolean };
        try {
          addItem(a, v, r.question ?? raw, typeof r.points === 'number' ? Math.max(0, Math.min(100, r.points)) : 1, !!r.long, [], false);
          added++;
        } catch (err) {
          problems.push(`Question ${i + 1}: ${err instanceof Error ? err.message : 'not understood'}`);
        }
      });
    });
    touch(a.id);
    return { added, problems, items: itemsOf(s, a.id, v) };
  });

  /** Asks the AI to draft questions from the attached materials. Each one must be reviewed before publishing. */
  s.route('POST', '/assessments/:id/items/draft', async (c, [id]) => {
    const { a, cls, user } = assessmentFor(s, c, id!, 'teacher');
    const b = s.parse(DraftItemsBody, c.body);
    const ai = s.ai(cls.school_id);
    if (!ai) throw new HttpError(409, 'ai_unavailable', 'No AI key is set up for your school, so questions cannot be drafted. You can still write them yourself.');
    if (s.budget(cls.school_id).state === 'paused') throw new HttpError(409, 'budget_paused', 'Your school’s AI budget for this month is used up. Ask an administrator, or write the questions yourself.');
    const mats = json<string[]>(a.material_ids, [])
      .map((mid) => db.get<{ id: string; name: string; status: string }>('SELECT id, name, status FROM materials WHERE id = ?', [mid]))
      .filter((m): m is { id: string; name: string; status: string } => !!m && m.status === 'ready')
      .map((m) => ({ title: m.name, pages: db.all<{ text: string }>('SELECT text FROM material_pages WHERE material_id = ? ORDER BY page', [m.id]).map((p) => p.text) }));
    if (!mats.length) throw new HttpError(400, 'no_materials', 'Attach at least one material with readable text first; questions are drafted from your materials.');
    const st = s.settings(cls.school_id);
    const p = draftItemsPrompt({ title: a.title, count: b.count, focus: b.focus, materials: mats });
    let out: ReturnType<typeof DraftItemsOutput.safeParse> | null = null;
    try {
      for (let attempt = 0; attempt < 2 && !out?.success; attempt++) {
        const r = await ai.judge({ model: st.aiModel, effort: st.gradingEffort, system: p.system, user: p.user, schema: DraftItemsOutput });
        s.recordUsage({ schoolId: cls.school_id, classId: cls.id, assessmentId: a.id, kind: 'draft_items', model: r.model, usage: r.usage });
        if (r.stop === 'refusal') throw new HttpError(502, 'ai_refused', 'The AI declined this request.');
        try {
          out = r.stop === 'end' && r.text ? DraftItemsOutput.safeParse(JSON.parse(r.text)) : null;
        } catch {
          out = null;
        }
      }
    } catch (err) {
      if (err instanceof AiProviderError) throw new HttpError(502, `ai_${err.kind}`, AI_ERROR_MESSAGE[err.kind]);
      throw err;
    }
    if (!out?.success) throw new HttpError(502, 'ai_invalid', 'The AI’s reply could not be used, so no questions were added. Try again.');
    const v = editableVersion(a);
    const skipped: string[] = [];
    const added: string[] = [];
    for (const d of out.data.items.slice(0, b.count)) {
      const base = { prompt: d.prompt, solution: d.source ? `Source: ${d.source}` : '' };
      const raw =
        d.type === 'multiple_choice'
          ? { ...base, type: d.type, choices: d.choices, answer: d.correctChoice }
          : d.type === 'true_false'
            ? { ...base, type: d.type, answer: d.correctBool }
            : d.type === 'short_answer'
              ? { ...base, type: d.type, accepted: d.acceptedAnswers }
              : { ...base, type: 'written' as const, sampleAnswer: d.teacherNotes || null };
      try {
        added.push(addItem(a, v, raw, 1, false, [], true));
      } catch (err) {
        skipped.push(err instanceof Error ? err.message : 'not usable');
      }
    }
    touch(a.id);
    s.audit(user, cls.school_id, 'assessment.ai_drafted', `${cls.name}: ${a.title}`, `${added.length} questions drafted`);
    return { added: added.length, skipped, items: itemsOf(s, a.id, v) };
  });

  // ─────────── Curriculum (for linking classes and questions to Ontario expectations) ───────────

  let bundle: ReturnType<typeof readBundleFile> | null | undefined;
  const curriculum = () => {
    if (bundle === undefined) {
      try {
        bundle = s.opts.curriculumPath === null ? null : readBundleFile(s.opts.curriculumPath ?? path.join(process.cwd(), 'resources', 'curriculum', 'ontario.json.gz'));
      } catch {
        bundle = null;
      }
    }
    return bundle;
  };

  s.route('GET', '/curriculum/courses', (c) => {
    s.requireRole(c, 'teacher', 'admin');
    const grade = Number(c.url.searchParams.get('grade')) || null;
    return (curriculum()?.courses ?? [])
      .filter((x) => x.expectationsSource === 'digital' && (!grade || x.grades.includes(grade)))
      .map((x) => ({ id: x.id, label: courseLabel(x), grades: x.grades }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  s.route('GET', '/curriculum/courses/:id/expectations', (c, [id]) => {
    s.requireRole(c, 'teacher', 'admin');
    const b = curriculum();
    if (!b?.courses.some((x) => x.id === id)) throw notFound('That course');
    const strands = new Map(b.strands.filter((x) => x.courseId === id).map((x) => [x.id, x]));
    return b.expectations
      .filter((e) => e.courseId === id && e.kind === 'specific')
      .sort((x, y) => x.sort - y.sort)
      .map((e) => ({ id: e.id, index: e.index, strand: strands.get(e.strandId)?.title ?? '', text: e.text.slice(0, 300) }));
  });

  void forbidden;
  void promptText;
}

export type { ItemDto, Ctx };

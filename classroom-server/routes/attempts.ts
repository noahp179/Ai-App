import { HONEST_LIMITS, looksLikeRuleChange, recordedNotice } from '../../src/shared/classroom/integrity';
import { isAnswered, parseResponse, promptText, redactQuestion } from '../../src/shared/classroom/items';
import {
  AutosaveBody,
  ChatBody,
  IntegrityBatchBody,
  StartAttemptBody,
  StudentReplyBody,
  type Accommodation,
  type AssessmentIntroDto,
  type AttemptDto,
  type ChatMessageDto,
  type ChatStreamEvent,
  type CitationDto,
  type ItemDto,
  type Question,
  type Response,
  type ResultDto,
  type StudentItemDto,
} from '../../src/shared/classroom/protocol';
import { answerText } from '../../src/shared/study/checking';
import { AI_ERROR_MESSAGE, AiProviderError, type ChatTurn } from '../ai/provider';
import { assistantSystem, studentDraft, studentMessage } from '../ai/prompts';
import { HANDLED, HttpError, NO_ACCOMMODATION, json, notFound, type Ctx, type S } from '../core';
import { GRACE_MS, assessmentFor, attemptFor, expireAttempts, finalizeAttempt, itemsOf, phaseOf, requireOpen, settingsOf, type AssessmentRow, type AttemptRow } from '../lifecycle';
import { documentsFor, pageOf, type MaterialRow } from './materials';

export interface ChatRow {
  id: string;
  attempt_id: string;
  role: 'student' | 'assistant';
  content: string;
  payload: string | null;
  citations: string;
  kind: 'message' | 'draft';
  status: ChatMessageDto['status'];
  error: string | null;
  model: string | null;
  created_at: string;
}
export const chatDto = (r: ChatRow): ChatMessageDto => ({ id: r.id, role: r.role, content: r.content, citations: json<CitationDto[]>(r.citations, []), kind: r.kind, status: r.status, error: r.error, createdAt: r.created_at });

/** Deterministic per-attempt shuffle. */
function shuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h ^ (h >>> 13), 1274126177) ^ i) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function studentItems(items: ItemDto[], t: Pick<AttemptRow, 'id' | 'item_order'>, shuffleChoices: boolean): StudentItemDto[] {
  const order = json<string[]>(t.item_order, []);
  const sorted = order.length ? order.map((id) => items.find((i) => i.id === id)).filter((i): i is ItemDto => !!i) : items;
  return sorted.map((it, i) => {
    let q: Question = redactQuestion(it.question);
    if (shuffleChoices && (q.type === 'multiple_choice' || q.type === 'multiple_select')) q = { ...q, choices: shuffle(q.choices, `${t.id}:${it.id}`) };
    return { id: it.id, position: i + 1, points: it.points, question: q, long: it.long };
  });
}

export function registerAttempts(s: S): void {
  const { db } = s;
  const streaming = new Set<string>();

  const attemptDto = (t: AttemptRow, a: AssessmentRow): AttemptDto => {
    const st = settingsOf(a);
    const mats = json<string[]>(a.material_ids, [])
      .map((id) => db.get<MaterialRow>('SELECT * FROM materials WHERE id = ?', [id]))
      .filter((m): m is MaterialRow => !!m);
    return {
      id: t.id,
      assessmentId: a.id,
      classId: a.class_id,
      title: a.title,
      instructions: a.instructions,
      number: t.number,
      status: t.status,
      startedAt: t.started_at,
      deadline: t.deadline,
      serverNow: s.now(),
      submittedAt: t.submitted_at,
      autoSubmitted: t.auto_submitted === 1,
      reference: t.reference,
      settings: { kind: st.kind, layout: st.layout, aiMode: st.aiMode, messageLimit: st.messageLimit, blockPaste: st.blockPaste, logFocus: st.logFocus, largeInsertSignal: st.largeInsertSignal, largeInsertChars: st.largeInsertChars, transcriptVisible: st.transcriptVisible, showResults: st.showResults },
      accommodation: { ...NO_ACCOMMODATION, ...json<Partial<Accommodation>>(t.accommodation, {}) },
      items: studentItems(itemsOf(s, a.id, t.version), t, st.shuffleChoices),
      responses: json<Record<string, Response>>(t.responses, {}),
      flags: json<string[]>(t.flags, []),
      messagesUsed: db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM chat_messages WHERE attempt_id = ? AND role = 'student'`, [t.id])!.n,
      materials: mats.map((m) => ({ id: m.id, name: m.name, pages: m.pages })),
    };
  };

  s.sweeps.push(() => void expireAttempts(s));

  /** What the student must read and accept before starting. */
  s.route('GET', '/assessments/:id/intro', (c, [id]) => {
    const { a, cls, user } = assessmentFor(s, c, id!, 'student');
    const st = settingsOf(a);
    const acc = s.accommodation(cls.id, user.id);
    const mine = db.all<{ id: string; status: string }>('SELECT id, status FROM attempts WHERE assessment_id = ? AND user_id = ?', [a.id, user.id]);
    const notice = recordedNotice({ aiMode: st.aiMode, blockPaste: st.blockPaste && !acc.pasteAllowed, logFocus: st.logFocus, largeInsertSignal: st.largeInsertSignal && !acc.pasteAllowed });
    const items = db.get<{ n: number; p: number | null }>('SELECT COUNT(*) AS n, SUM(points) AS p FROM assessment_items WHERE assessment_id = ? AND version = ?', [a.id, a.version])!;
    return {
      assessment: { id: a.id, title: a.title, instructions: a.instructions, phase: phaseOf(a, s.now()), items: items.n, points: items.p ?? 0, settings: st },
      accommodation: acc,
      attemptsUsed: mine.length,
      inProgress: mine.find((m) => m.status === 'in_progress')?.id ?? null,
      recorded: notice.recorded,
      neverRecorded: notice.never,
      limits: HONEST_LIMITS,
    } satisfies AssessmentIntroDto;
  });

  s.route('POST', '/assessments/:id/attempts', (c, [id]) => {
    const { a, cls, user } = assessmentFor(s, c, id!, 'student');
    s.parse(StartAttemptBody, c.body);
    expireAttempts(s);
    const open = db.get<AttemptRow>(`SELECT * FROM attempts WHERE assessment_id = ? AND user_id = ? AND status = 'in_progress'`, [a.id, user.id]);
    if (open) return attemptDto(open, a);
    const phase = phaseOf(a, s.now());
    if (phase === 'scheduled') throw new HttpError(409, 'not_open', 'This assessment has not opened yet.');
    if (phase === 'closed') throw new HttpError(409, 'closed', 'This assessment has closed.');
    const st = settingsOf(a);
    const used = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM attempts WHERE assessment_id = ? AND user_id = ?', [a.id, user.id])!.n;
    if (used >= st.attempts) throw new HttpError(409, 'no_attempts_left', 'You have used all your attempts for this assessment.');
    const acc = s.accommodation(cls.id, user.id);
    const now = s.clock.now();
    // The deadline is fixed here, on the server's clock: time limit (plus any extra time), never past the closing time.
    const byLimit = st.timeLimitMinutes ? now.getTime() + st.timeLimitMinutes * 60_000 * (1 + acc.extraTimePercent / 100) : Infinity;
    const byClose = st.closesAt ? Date.parse(st.closesAt) : Infinity;
    const deadline = Math.min(byLimit, byClose);
    const tid = s.newId();
    const items = itemsOf(s, a.id, a.version);
    const order = st.shuffleQuestions ? shuffle(items.map((i) => i.id), tid) : items.map((i) => i.id);
    db.run(`INSERT INTO attempts (id, assessment_id, version, user_id, number, status, acknowledged_at, started_at, deadline, item_order, accommodation, updated_at) VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?)`, [
      tid,
      a.id,
      a.version,
      user.id,
      used + 1,
      now.toISOString(),
      now.toISOString(),
      Number.isFinite(deadline) ? new Date(deadline).toISOString() : null,
      JSON.stringify(order),
      JSON.stringify(acc),
      now.toISOString(),
    ]);
    return attemptDto(db.get<AttemptRow>('SELECT * FROM attempts WHERE id = ?', [tid])!, a);
  });

  s.route('GET', '/attempts/:id', (c, [id]) => {
    const { t, a } = attemptFor(s, c, id!, 'owner');
    const late = t.status === 'in_progress' && !!t.deadline && Date.parse(s.now()) > Date.parse(t.deadline) + GRACE_MS;
    return attemptDto(late ? finalizeAttempt(s, t.id, true) : t, a);
  });

  /** Autosave. Keeps the latest answers and, for written answers, occasional snapshots (not keystrokes). */
  s.route('PUT', '/attempts/:id/responses', (c, [id]) => {
    const { t, a } = attemptFor(s, c, id!, 'owner');
    requireOpen(s, t);
    const b = s.parse(AutosaveBody, c.body);
    const items = new Map(itemsOf(s, a.id, t.version).map((i) => [i.id, i]));
    const responses = json<Record<string, Response>>(t.responses, {});
    const seconds = json<Record<string, number>>(t.seconds, {});
    const now = s.now();
    db.tx(() => {
      for (const [itemId, raw] of Object.entries(b.responses)) {
        const item = items.get(itemId);
        if (!item) continue;
        if (raw === null) {
          delete responses[itemId];
          continue;
        }
        const r = parseResponse(item.question, raw);
        if (!r) throw new HttpError(400, 'invalid_response', 'An answer was not in the expected form.');
        responses[itemId] = r;
        if (r.type === 'written' || r.type === 'text') {
          const last = db.get<{ text: string; at: string }>('SELECT text, at FROM snapshots WHERE attempt_id = ? AND item_id = ? ORDER BY at DESC LIMIT 1', [t.id, itemId]);
          const changed = !last || last.text !== r.text;
          if (changed && (!last || Date.parse(now) - Date.parse(last.at) >= 30_000 || Math.abs(r.text.length - last.text.length) >= 120)) db.run('INSERT INTO snapshots (attempt_id, item_id, at, text) VALUES (?, ?, ?, ?)', [t.id, itemId, now, r.text]);
        }
      }
      for (const [itemId, n] of Object.entries(b.seconds)) if (items.has(itemId)) seconds[itemId] = Math.round((seconds[itemId] ?? 0) + n);
      const flags = b.flags ? b.flags.filter((f) => items.has(f)) : json<string[]>(t.flags, []);
      db.run('UPDATE attempts SET responses = ?, seconds = ?, flags = ?, updated_at = ? WHERE id = ?', [JSON.stringify(responses), JSON.stringify(seconds), JSON.stringify(flags), now, t.id]);
    });
    return { savedAt: now, serverNow: now, deadline: t.deadline };
  });

  /** Paste attempts, focus changes and large insertions, reported by the client while the attempt is open. */
  s.route('POST', '/attempts/:id/events', (c, [id]) => {
    const { t, a } = attemptFor(s, c, id!, 'owner');
    if (t.status !== 'in_progress') return { recorded: 0 };
    const b = s.parse(IntegrityBatchBody, c.body);
    const st = settingsOf(a);
    const acc = { ...NO_ACCOMMODATION, ...json<Partial<Accommodation>>(t.accommodation, {}) };
    const now = s.now();
    let n = 0;
    for (const e of b.events) {
      const pasteKind = e.kind === 'paste_blocked' || e.kind === 'drop_blocked' || e.kind === 'copy_blocked';
      if (pasteKind && !st.blockPaste) continue;
      if (e.kind === 'focus_lost' && !st.logFocus) continue;
      if (e.kind === 'large_insert' && !st.largeInsertSignal) continue;
      // An accommodation is never turned into a signal.
      if (acc.pasteAllowed && (e.kind === 'paste_blocked' || e.kind === 'drop_blocked' || e.kind === 'large_insert')) continue;
      const at = e.at < t.started_at ? t.started_at : e.at > now ? now : e.at;
      db.run('INSERT INTO integrity_events (id, attempt_id, kind, item_id, at, detail) VALUES (?, ?, ?, ?, ?, ?)', [s.newId(), t.id, e.kind, e.itemId, at, JSON.stringify(e.detail)]);
      n++;
    }
    return { recorded: n };
  });

  s.route('GET', '/attempts/:id/chat', (c, [id]) => {
    const { t } = attemptFor(s, c, id!, 'owner');
    return db.all<ChatRow>('SELECT * FROM chat_messages WHERE attempt_id = ? ORDER BY created_at, rowid', [t.id]).map(chatDto);
  });

  /** A page of an attached material, so a student can open the source the assistant cited. */
  s.route('GET', '/attempts/:id/materials/:material/pages/:n', (c, [id, mid, n]) => {
    const { a } = attemptFor(s, c, id!, 'owner');
    if (!json<string[]>(a.material_ids, []).includes(mid!)) throw notFound('That material');
    const m = db.get<MaterialRow>('SELECT * FROM materials WHERE id = ?', [mid!]);
    if (!m) throw notFound('That material');
    return pageOf(s, m, Number(n));
  });

  /** One chat turn with the assistant, streamed as server-sent events. */
  s.route('POST', '/attempts/:id/chat', async (c, [id]) => {
    const { t, a, cls, user } = attemptFor(s, c, id!, 'owner');
    requireOpen(s, t);
    const b = s.parse(ChatBody, c.body);
    const st = settingsOf(a);
    if (st.aiMode === 'off') throw new HttpError(409, 'ai_off', 'There is no AI assistant in this assessment.');
    const ai = s.ai(cls.school_id);
    if (!ai) throw new HttpError(409, 'ai_unavailable', 'The AI assistant is not set up for your school. Carry on with your answers and tell your teacher.');
    if (s.budget(cls.school_id).state === 'paused') throw new HttpError(409, 'budget_paused', 'The AI assistant is paused because your school’s AI budget for this month is used up. Carry on with your answers and tell your teacher.');
    const used = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM chat_messages WHERE attempt_id = ? AND role = 'student'`, [t.id])!.n;
    if (st.messageLimit && used >= st.messageLimit) throw new HttpError(409, 'message_limit', `You have used all ${st.messageLimit} messages allowed in this assessment.`);
    if (streaming.has(t.id)) throw new HttpError(409, 'busy', 'The assistant is still answering. Wait for it to finish.');

    const items = studentItems(itemsOf(s, a.id, t.version), t, false);
    let content = b.text;
    let prompt = studentMessage(b.text);
    let kind: 'message' | 'draft' = 'message';
    if (b.draftForItem) {
      const item = items.find((i) => i.id === b.draftForItem);
      const r = json<Record<string, Response>>(t.responses, {})[b.draftForItem];
      const draft = r && (r.type === 'written' || r.type === 'text') ? r.text.trim() : '';
      if (!item || !draft) throw new HttpError(400, 'no_draft', 'Write something in your answer first, then ask about it.');
      kind = 'draft';
      // The transcript shows exactly what was shared.
      content = `${b.text}\n\n[Shared my draft answer to question ${item.position}]\n${draft}`;
      prompt = studentDraft(item.position, promptText(item.question), draft, b.text);
    }
    const now = s.clock.now();
    const studentId = s.newId();
    const assistantId = s.newId();
    db.tx(() => {
      db.run(`INSERT INTO chat_messages (id, attempt_id, role, content, payload, kind, status, created_at) VALUES (?, ?, 'student', ?, ?, ?, 'complete', ?)`, [studentId, t.id, content, JSON.stringify(prompt), kind, now.toISOString()]);
      db.run(`INSERT INTO chat_messages (id, attempt_id, role, content, status, created_at) VALUES (?, ?, 'assistant', '', 'streaming', ?)`, [assistantId, t.id, new Date(now.getTime() + 1).toISOString()]);
      // A phrase like "ignore your instructions" is noted for the teacher. It changes nothing about the assistant.
      if (looksLikeRuleChange(b.text)) db.run(`INSERT INTO integrity_events (id, attempt_id, kind, item_id, at, detail) VALUES (?, ?, 'rule_change_attempt', NULL, ?, ?)`, [s.newId(), t.id, now.toISOString(), JSON.stringify({ text: b.text.slice(0, 200) })]);
    });
    const row = (mid: string) => chatDto(db.get<ChatRow>('SELECT * FROM chat_messages WHERE id = ?', [mid])!);

    c.res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no', 'x-content-type-options': 'nosniff' });
    const send = (e: ChatStreamEvent) => void c.res.write(`data: ${JSON.stringify(e)}\n\n`);
    send({ type: 'start', student: row(studentId), assistant: row(assistantId) });

    const abort = new AbortController();
    c.res.on('close', () => abort.abort());
    streaming.add(t.id);
    let acc = '';
    try {
      const school = s.settings(cls.school_id);
      const history = db.all<ChatRow>(`SELECT * FROM chat_messages WHERE attempt_id = ? AND id != ? AND status = 'complete' ORDER BY created_at, rowid`, [t.id, assistantId]);
      const turns: ChatTurn[] = history.map((m) => (m.role === 'student' ? { role: 'user', text: json<string>(m.payload, studentMessage(m.content)) } : { role: 'assistant', text: m.content, payload: json<unknown>(m.payload, undefined) }));
      const documents = await documentsFor(s, json<string[]>(a.material_ids, []), ai);
      const r = await ai.chat({
        model: school.aiModel,
        effort: school.assistantEffort,
        // No names and nothing about this student: the same prompt and materials for the whole class.
        system: assistantSystem({ title: a.title, mode: st.aiMode, allowGeneralKnowledge: st.allowGeneralKnowledge, questions: items.map((i) => promptText(i.question)), hasMaterials: documents.length > 0 }),
        documents,
        turns,
        onDelta: (d) => {
          acc += d;
          send({ type: 'delta', text: d });
        },
        signal: abort.signal,
      });
      s.recordUsage({ schoolId: cls.school_id, classId: cls.id, assessmentId: a.id, kind: 'assistant', model: r.model, usage: r.usage });
      const titles = new Map(documents.map((d) => [d.materialId, d.title]));
      const citations: CitationDto[] = r.citations.map((x) => ({ materialId: x.materialId, title: titles.get(x.materialId) ?? 'Material', page: x.page, quote: x.quote.slice(0, 600) }));
      if (r.stop === 'refusal') db.run(`UPDATE chat_messages SET content = ?, status = 'refused', model = ? WHERE id = ?`, ['The AI declined this request.', r.model, assistantId]);
      else
        db.run(`UPDATE chat_messages SET content = ?, payload = ?, citations = ?, status = 'complete', error = ?, model = ? WHERE id = ?`, [
          r.text || acc,
          JSON.stringify(r.payload ?? null),
          JSON.stringify(citations),
          r.stop === 'max_tokens' ? 'This reply was cut off at the length limit.' : null,
          r.model,
          assistantId,
        ]);
      send({ type: 'done', assistant: row(assistantId) });
    } catch (err) {
      const message = abort.signal.aborted ? 'Stopped.' : err instanceof AiProviderError ? AI_ERROR_MESSAGE[err.kind] : 'The assistant could not answer. Try again.';
      if (!(err instanceof AiProviderError) && !abort.signal.aborted) s.opts.log?.(`chat failed: ${(err as Error).stack ?? err}`);
      db.run(`UPDATE chat_messages SET content = ?, status = 'error', error = ? WHERE id = ?`, [acc, message, assistantId]);
      send({ type: 'error', message, assistant: row(assistantId) });
    } finally {
      streaming.delete(t.id);
      c.res.end();
    }
    void user;
    return HANDLED;
  });

  s.route('POST', '/attempts/:id/submit', (c, [id]) => {
    const { t } = attemptFor(s, c, id!, 'owner');
    if (t.status === 'submitted') return { reference: t.reference, submittedAt: t.submitted_at, autoSubmitted: t.auto_submitted === 1 };
    // After the deadline (plus a short grace for slow connections) the saved answers are what count.
    const late = !!t.deadline && Date.parse(s.now()) > Date.parse(t.deadline) + GRACE_MS;
    const done = finalizeAttempt(s, t.id, late);
    if (late) throw new HttpError(409, 'time_up', 'Time is up. Your saved answers were submitted.');
    return { reference: done.reference, submittedAt: done.submitted_at, autoSubmitted: false };
  });

  /** What a student sees of their own submission: only what has been released (or, for practice set to show at once, the auto-marked parts). */
  s.route('GET', '/attempts/:id/result', (c, [id]) => {
    const { t, a } = attemptFor(s, c, id!, 'owner');
    if (t.status !== 'submitted') throw new HttpError(409, 'not_submitted', 'Submit the assessment first.');
    const st = settingsOf(a);
    const released = !!t.released_at;
    const immediate = st.showResults === 'immediately';
    if (!released && !immediate) throw new HttpError(409, 'not_released', 'Your teacher has not released the results yet.');
    const items = itemsOf(s, a.id, t.version);
    const responses = json<Record<string, Response>>(t.responses, {});
    const grades = new Map(db.all<{ item_id: string; score: number | null; source: string | null; levels: string | null; comment: string; highlights: string }>('SELECT * FROM grades WHERE attempt_id = ?', [t.id]).map((g) => [g.item_id, g]));
    const shown = studentItems(items, t, false);
    const out: ResultDto = {
      attemptId: t.id,
      title: a.title,
      submittedAt: t.submitted_at,
      released,
      total: { score: null, max: items.reduce((x, i) => x + i.points, 0) },
      overallComment: released ? t.overall_comment : '',
      items: shown.map((it) => {
        const full = items.find((i) => i.id === it.id)!;
        const g = grades.get(it.id);
        // Before release only marks decided by the checker are shown; a teacher's or AI's are not.
        const visible = released || g?.source === 'auto';
        return {
          item: it,
          response: responses[it.id] ?? null,
          score: visible ? (g?.score ?? null) : null,
          points: it.points,
          levels: released ? json<Record<string, number> | null>(g?.levels, null) : null,
          comment: released ? (g?.comment ?? '') : '',
          highlights: released ? json(g?.highlights, []) : [],
          correctAnswer: visible && full.question.type !== 'written' ? answerText(full.question) : null,
          solution: visible ? full.question.solution : [],
        };
      }),
      transcript: null,
      evaluation: null,
    };
    const decided = out.items.every((i) => i.score !== null);
    if (decided) out.total.score = Math.round(out.items.reduce((x, i) => x + (i.score ?? 0), 0) * 100) / 100;
    if (released && st.transcriptVisible) {
      out.transcript = db.all<ChatRow>('SELECT * FROM chat_messages WHERE attempt_id = ? ORDER BY created_at, rowid', [t.id]).map(chatDto);
      const ev = db.get<{ rubric: string; suggested: string | null; final: string | null; student_reply: string | null }>('SELECT rubric, suggested, final, student_reply FROM ai_evaluations WHERE attempt_id = ?', [t.id]);
      const final = json<{ levels: Record<string, number>; comment: string } | null>(ev?.final, null);
      // Only the teacher's decision is ever shown, never the AI's suggestion on its own.
      if (ev && final) {
        const suggested = json<{ criteria: { criterionId: string; quotes: { messageId: string; text: string }[] }[] } | null>(ev.suggested, null);
        out.evaluation = { rubric: json(ev.rubric, []), levels: final.levels, comment: final.comment, evidence: (suggested?.criteria ?? []).map((x) => ({ criterionId: x.criterionId, quotes: x.quotes })), studentReply: ev.student_reply };
      }
    }
    return out;
  });

  /** A student asks the teacher to look again at the AI-use evaluation. */
  s.route('POST', '/attempts/:id/evaluation-reply', (c, [id]) => {
    const { t, a } = attemptFor(s, c, id!, 'owner');
    const b = s.parse(StudentReplyBody, c.body);
    if (!t.released_at || !settingsOf(a).transcriptVisible) throw new HttpError(409, 'not_released', 'There is nothing to reply to yet.');
    db.run('UPDATE ai_evaluations SET student_reply = ?, updated_at = ? WHERE attempt_id = ?', [b.text, s.now(), t.id]);
    return { ok: true };
  });

  /** Everything this service holds about the signed-in student, as JSON. */
  s.route('GET', '/my/export', (c) => {
    const u = s.requireRole(c, 'student');
    const attempts = db.all<AttemptRow>('SELECT * FROM attempts WHERE user_id = ?', [u.id]);
    return {
      format: 'flowcompanion.classroom.student-export',
      exportedAt: s.now(),
      account: { displayName: u.display_name, login: u.login },
      classes: db.all<{ name: string; status: string; joined_at: string }>('SELECT c.name, m.status, m.joined_at FROM class_members m JOIN classes c ON c.id = m.class_id WHERE m.user_id = ?', [u.id]),
      attempts: attempts.map((t) => ({
        assessment: db.get<{ title: string }>('SELECT title FROM assessments WHERE id = ?', [t.assessment_id])?.title,
        number: t.number,
        status: t.status,
        startedAt: t.started_at,
        submittedAt: t.submitted_at,
        responses: json(t.responses, {}),
        chat: db.all<ChatRow>('SELECT * FROM chat_messages WHERE attempt_id = ? ORDER BY created_at, rowid', [t.id]).map((m) => ({ role: m.role, content: m.content, at: m.created_at })),
        events: db.all<{ kind: string; at: string; detail: string }>('SELECT kind, at, detail FROM integrity_events WHERE attempt_id = ? ORDER BY at', [t.id]).map((e) => ({ kind: e.kind, at: e.at, detail: json(e.detail, {}) })),
        released: !!t.released_at,
      })),
    };
  });

  void isAnswered;
  void (null as unknown as Ctx);
}

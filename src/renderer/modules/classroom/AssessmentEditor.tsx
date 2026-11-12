import { ArrowDown, ArrowUp, Check, Pencil, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { AI_MODE_LABEL, AI_MODE_STUDENT, AI_MODES, ASSESSMENT_KIND_LABEL, ASSESSMENT_KINDS, type AssessmentDto, type AssessmentSettings, type ItemDto, type MaterialDto } from '../../../shared/classroom/protocol';
import { Badge, Banner, Button, EmptyState, Field, Input, Modal, Select, Tabs, Textarea, Toggle, useConfirm } from '../../components/ui';
import { Blocks } from '../study/render';
import { ErrorNote, Loaded, PageHeader, fromLocalInput, pts, toLocalInput } from './common';
import { useAction, useClassroom, useGet, useTransport } from './context';
import { ItemEditor, TYPE_LABEL } from './ItemEditor';
import { Overview, Submissions } from './Submissions';

type Tab = 'questions' | 'settings' | 'submissions' | 'overview';

function DraftWithAi({ a, onClose, onDone }: { a: AssessmentDto; onClose: () => void; onDone: () => void }) {
  const { run, busy, error } = useAction();
  const [count, setCount] = useState(5);
  const [focus, setFocus] = useState('');
  const [result, setResult] = useState<{ added: number; skipped: string[] } | null>(null);
  const draft = async () => {
    const r = await run<{ added: string[]; skipped: string[] }>('draft', 'POST', `/assessments/${a.id}/items/draft`, { count, focus });
    if (r) {
      setResult({ added: r.added.length, skipped: r.skipped });
      onDone();
    }
  };
  return (
    <Modal
      title="Draft questions with AI"
      onClose={onClose}
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            Review the drafts
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" icon={<Sparkles size={15} />} onClick={draft} loading={busy === 'draft'} disabled={!a.materialIds.length}>
              Draft
            </Button>
          </>
        )
      }
    >
      <div className="stack-3">
        {result ? (
          <p role="status">
            Added {result.added} draft question{result.added === 1 ? '' : 's'}.{result.skipped.length ? ` ${result.skipped.length} could not be used and were left out.` : ''} Each one is marked “AI-drafted”; check the question and its answer key, then accept or edit it. Nothing reaches
            students until every draft is reviewed.
          </p>
        ) : (
          <>
            <p className="small muted">The AI drafts questions from the materials attached to this assessment (Settings tab), and says which part each came from. It can be wrong: you review every draft before publishing.</p>
            {!a.materialIds.length ? <Banner tone="warn">Attach at least one material in the Settings tab first.</Banner> : null}
            <Field label="How many" htmlFor="dr-n">
              <Input id="dr-n" type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} style={{ maxWidth: 100 }} />
            </Field>
            <Field label="Focus (optional)" htmlFor="dr-focus" hint="e.g. the difference between plant and animal cells">
              <Input id="dr-focus" value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={500} />
            </Field>
          </>
        )}
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

function Questions({ a, reload }: { a: AssessmentDto; reload: () => void }) {
  const t = useTransport();
  const confirm = useConfirm();
  const items = useGet<ItemDto[]>(`/assessments/${a.id}/items`);
  const [editing, setEditing] = useState<ItemDto | 'new' | null>(null);
  const [drafting, setDrafting] = useState(false);
  const { run, error, setError } = useAction();
  const changed = () => {
    items.reload();
    reload();
  };
  const move = async (list: ItemDto[], i: number, d: -1 | 1) => {
    const ids = list.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d]!, ids[i]!];
    if (await run('move', 'POST', `/assessments/${a.id}/items/reorder`, { itemIds: ids })) changed();
  };
  const remove = async (it: ItemDto) => {
    if (!(await confirm({ title: `Delete question ${it.position}?`, message: 'Students who already submitted keep the version they answered.', confirmLabel: 'Delete', danger: true }))) return;
    if (await run('delete', 'DELETE', `/assessments/${a.id}/items/${it.id}`)) changed();
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await t.request('POST', `/assessments/${a.id}/items/import`, { json: await file.text() });
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="stack-4">
      <div className="row-wrap">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing('new')}>
          Add question
        </Button>
        <Button icon={<Sparkles size={15} />} onClick={() => setDrafting(true)}>
          Draft with AI
        </Button>
        <label className="btn ghost">
          <Upload size={15} aria-hidden /> Import JSON
          <input type="file" accept=".json,application/json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
        </label>
        <span className="grow" />
        <span className="small muted">
          {a.items} questions · {pts(a.points)} points
        </span>
      </div>
      {a.version > 1 || (a.submissions ?? 0) > 0 ? <p className="small muted">Students who have started keep the version they started with; changes apply to new attempts.</p> : null}
      <ErrorNote error={error} />
      <Loaded q={items}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No questions yet">Write questions yourself, import them, or have the AI draft some from your materials for you to review.</EmptyState>
          ) : (
            <ol className="stack-3 item-list">
              {list.map((it, i) => (
                <li key={it.id} className="card stack-2">
                  <div className="row-wrap">
                    <strong>Question {it.position}</strong>
                    <Badge tone="outline">{TYPE_LABEL[it.question.type] ?? it.question.type}</Badge>
                    <span className="small muted">{pts(it.points)} pts</span>
                    {it.aiDrafted ? <Badge tone={it.reviewed ? 'info' : 'warn'}>{it.reviewed ? 'AI-drafted · reviewed' : 'AI-drafted · not reviewed'}</Badge> : null}
                    <span className="grow" />
                    <Button size="sm" variant="ghost" icon={<ArrowUp size={14} />} aria-label={`Move question ${it.position} up`} disabled={i === 0} onClick={() => void move(list, i, -1)} />
                    <Button size="sm" variant="ghost" icon={<ArrowDown size={14} />} aria-label={`Move question ${it.position} down`} disabled={i === list.length - 1} onClick={() => void move(list, i, 1)} />
                    {it.aiDrafted && !it.reviewed ? (
                      <Button size="sm" icon={<Check size={14} />} onClick={async () => (await run('accept', 'PATCH', `/assessments/${a.id}/items/${it.id}`, { reviewed: true })) && changed()}>
                        Accept
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditing(it)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={`Delete question ${it.position}`} onClick={() => void remove(it)} />
                  </div>
                  <Blocks blocks={it.question.prompt} />
                  <AnswerKey it={it} />
                </li>
              ))}
            </ol>
          )
        }
      </Loaded>
      {editing ? (
        <ItemEditor
          assessmentId={a.id}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            changed();
          }}
        />
      ) : null}
      {drafting ? <DraftWithAi a={a} onClose={() => setDrafting(false)} onDone={changed} /> : null}
    </div>
  );
}

function AnswerKey({ it }: { it: ItemDto }) {
  const q = it.question;
  let key: string;
  switch (q.type) {
    case 'multiple_choice':
      key = q.choices.map((c) => (c.id === q.answer ? `✓ ${c.text}` : `· ${c.text}`)).join('   ');
      break;
    case 'multiple_select':
      key = q.choices.map((c) => (q.answers.includes(c.id) ? `✓ ${c.text}` : `· ${c.text}`)).join('   ');
      break;
    case 'true_false':
      key = q.answer ? 'True' : 'False';
      break;
    case 'numeric':
      key = `${q.answer}${q.unit ? ` ${q.unit}` : ''}${q.tolerance ? ` (± ${q.tolerance})` : ''}`;
      break;
    case 'expression':
      key = q.answer;
      break;
    case 'short_answer':
      key = q.accepted.join(' / ');
      break;
    case 'fill_blank':
      key = q.blanks.map((b, i) => `${i + 1}: ${b.accepted.join(' / ')}`).join('; ');
      break;
    case 'matching':
      key = q.left.map((l) => `${l.text} → ${q.right.find((r) => r.id === q.pairs[l.id])?.text}`).join('; ');
      break;
    case 'ordering':
      key = q.order.map((id) => q.items.find((x) => x.id === id)?.text).join(' → ');
      break;
    case 'written':
      key = q.sampleAnswer ? `Marking notes: ${q.sampleAnswer}` : `Marked by you with a ${q.rubric.length}-criterion rubric.`;
      break;
    default:
      key = '';
  }
  return <p className="small muted">{q.type === 'written' ? key : `Answer: ${key}`}</p>;
}

function SettingsTab({ a, onSaved }: { a: AssessmentDto; onSaved: (a: AssessmentDto) => void }) {
  const mats = useGet<MaterialDto[]>(`/classes/${a.classId}/materials`);
  const { run, busy, error } = useAction();
  const [title, setTitle] = useState(a.title);
  const [instructions, setInstructions] = useState(a.instructions);
  const [s, setS] = useState<AssessmentSettings>(a.settings);
  const [materialIds, setMaterialIds] = useState(a.materialIds);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof AssessmentSettings>(k: K, v: AssessmentSettings[K]) => (setS((p) => ({ ...p, [k]: v })), setSaved(false));
  const save = async () => {
    const r = await run<AssessmentDto>('save', 'PATCH', `/assessments/${a.id}`, { title, instructions, settings: s, materialIds });
    if (r) {
      setSaved(true);
      onSaved(r);
    }
  };
  return (
    <div className="stack-4" style={{ maxWidth: 760 }}>
      <section className="card stack-3" aria-labelledby="set-basic">
        <h2 className="h2" id="set-basic">
          Basics
        </h2>
        <Field label="Title" htmlFor="as-title">
          <Input id="as-title" value={title} onChange={(e) => (setTitle(e.target.value), setSaved(false))} />
        </Field>
        <Field label="Instructions for students" htmlFor="as-instr">
          <Textarea id="as-instr" rows={3} value={instructions} onChange={(e) => (setInstructions(e.target.value), setSaved(false))} />
        </Field>
        <Field label="Kind" htmlFor="as-kind">
          <Select id="as-kind" value={s.kind} onChange={(e) => set('kind', e.target.value as AssessmentSettings['kind'])}>
            {ASSESSMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {ASSESSMENT_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
      </section>
      <section className="card stack-3" aria-labelledby="set-time">
        <h2 className="h2" id="set-time">
          When and how long
        </h2>
        <div className="field-row">
          <Field label="Opens" htmlFor="as-open" hint="Empty: as soon as it is published.">
            <Input id="as-open" type="datetime-local" value={toLocalInput(s.opensAt)} onChange={(e) => set('opensAt', fromLocalInput(e.target.value))} />
          </Field>
          <Field label="Closes" htmlFor="as-close" hint="Work still open then is submitted automatically.">
            <Input id="as-close" type="datetime-local" value={toLocalInput(s.closesAt)} onChange={(e) => set('closesAt', fromLocalInput(e.target.value))} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Time limit (minutes)" htmlFor="as-limit" hint="Empty: no limit. Extra-time accommodations add to it.">
            <Input id="as-limit" type="number" min={1} max={600} value={s.timeLimitMinutes ?? ''} onChange={(e) => set('timeLimitMinutes', e.target.value ? Math.max(1, Number(e.target.value)) : null)} style={{ maxWidth: 120 }} />
          </Field>
          <Field label="Attempts allowed" htmlFor="as-att">
            <Input id="as-att" type="number" min={1} max={10} value={s.attempts} onChange={(e) => set('attempts', Math.max(1, Math.min(10, Number(e.target.value) || 1)))} style={{ maxWidth: 100 }} />
          </Field>
        </div>
        <Field label="Layout" htmlFor="as-layout">
          <Select id="as-layout" value={s.layout} onChange={(e) => set('layout', e.target.value as AssessmentSettings['layout'])}>
            <option value="one">One question at a time</option>
            <option value="all">All questions on one page</option>
          </Select>
        </Field>
        <Toggle checked={s.shuffleQuestions} onChange={(v) => set('shuffleQuestions', v)} label="Shuffle question order for each student" />
        <Toggle checked={s.shuffleChoices} onChange={(v) => set('shuffleChoices', v)} label="Shuffle multiple-choice options" />
      </section>
      <section className="card stack-3" aria-labelledby="set-ai">
        <h2 className="h2" id="set-ai">
          AI assistant
        </h2>
        <Field label="What the assistant may do" htmlFor="as-mode" hint={AI_MODE_STUDENT[s.aiMode]}>
          <Select id="as-mode" value={s.aiMode} onChange={(e) => set('aiMode', e.target.value as AssessmentSettings['aiMode'])}>
            {AI_MODES.map((m) => (
              <option key={m} value={m}>
                {AI_MODE_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        {s.aiMode !== 'off' ? (
          <>
            <fieldset className="stack-1">
              <legend className="small" style={{ fontWeight: 600 }}>
                Materials the assistant uses
              </legend>
              <Loaded q={mats}>
                {(list) =>
                  list.length === 0 ? (
                    <p className="small muted">No materials in this class yet (Materials tab).</p>
                  ) : (
                    <>
                      {list.map((m) => (
                        <label key={m.id} className="row small">
                          <input type="checkbox" checked={materialIds.includes(m.id)} onChange={(e) => (setMaterialIds(e.target.checked ? [...materialIds, m.id] : materialIds.filter((x) => x !== m.id)), setSaved(false))} />
                          {m.name} {m.status !== 'ready' ? <span className="muted">(no text)</span> : null}
                        </label>
                      ))}
                    </>
                  )
                }
              </Loaded>
            </fieldset>
            <Toggle checked={s.allowGeneralKnowledge} onChange={(v) => set('allowGeneralKnowledge', v)} label="Allow general knowledge" description="Off: the assistant answers only from your materials and says when something is not in them." />
            <Field label="Message limit per attempt" htmlFor="as-msgs" hint="Empty: no limit.">
              <Input id="as-msgs" type="number" min={1} max={200} value={s.messageLimit ?? ''} onChange={(e) => set('messageLimit', e.target.value ? Math.max(1, Number(e.target.value)) : null)} style={{ maxWidth: 120 }} />
            </Field>
            <Toggle checked={s.evaluateAiUse} onChange={(v) => set('evaluateAiUse', v)} label="Suggest an AI-use evaluation after each submission" description="An AI suggests a level for each AI-use criterion, quoting the chat. You decide; students see only your decision, after release." />
            <Toggle checked={s.transcriptVisible} onChange={(v) => set('transcriptVisible', v)} label="Students see their chat with their results" />
          </>
        ) : null}
      </section>
      <section className="card stack-3" aria-labelledby="set-rec">
        <h2 className="h2" id="set-rec">
          What is recorded
        </h2>
        <p className="small muted">Students are told exactly this before they start and must acknowledge it. Nothing outside the assessment page is ever recorded: no webcam, microphone, screen or keystrokes.</p>
        <Toggle checked={s.blockPaste} onChange={(v) => set('blockPaste', v)} label="Block pasting into answers" description="Blocked pastes are recorded as events. Students with a paste accommodation are not affected." />
        <Toggle checked={s.logFocus} onChange={(v) => set('logFocus', v)} label="Record when the student leaves the assessment page" description="Only that they left and for how long, not where they went." />
        <Toggle checked={s.largeInsertSignal} onChange={(v) => set('largeInsertSignal', v)} label="Record large amounts of text appearing at once" />
        {s.largeInsertSignal ? (
          <Field label="Characters at once" htmlFor="as-large">
            <Input id="as-large" type="number" min={50} max={5000} value={s.largeInsertChars} onChange={(e) => set('largeInsertChars', Math.max(50, Math.min(5000, Number(e.target.value) || 200)))} style={{ maxWidth: 120 }} />
          </Field>
        ) : null}
      </section>
      <section className="card stack-3" aria-labelledby="set-res">
        <h2 className="h2" id="set-res">
          Results
        </h2>
        <Field label="When students see results" htmlFor="as-show">
          <Select id="as-show" value={s.showResults} onChange={(e) => set('showResults', e.target.value as AssessmentSettings['showResults'])}>
            <option value="on_release">When I release them</option>
            <option value="immediately">Right after submitting (questions the checker marks only)</option>
          </Select>
        </Field>
      </section>
      <div className="row">
        <Button variant="primary" onClick={save} loading={busy === 'save'}>
          Save settings
        </Button>
        {saved ? (
          <span className="small" role="status">
            Saved.
          </span>
        ) : null}
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

export function AssessmentPage({ id, tab: initial }: { id: string; tab?: string }) {
  const { refresh, rememberTab } = useClassroom();
  const q = useGet<AssessmentDto>(`/assessments/${id}`);
  const [tab, setTab] = useState<Tab>((initial as Tab) ?? 'questions');
  const { run, busy, error } = useAction();
  const reload = () => {
    q.reload();
    refresh(`/classes/`);
  };
  return (
    <Loaded q={q}>
      {(a) => {
        const publish = async (on: boolean) => {
          const r = await run<AssessmentDto>('publish', 'POST', `/assessments/${a.id}/publish`, { publish: on });
          if (r) {
            q.set(() => r);
            refresh(`/classes/${a.classId}/assessments`);
          }
        };
        return (
          <div className="stack-4">
            <PageHeader
              title={a.title}
              subtitle={`${ASSESSMENT_KIND_LABEL[a.settings.kind]} · ${AI_MODE_LABEL[a.settings.aiMode]} · ${a.status === 'draft' ? 'Draft' : a.phase === 'open' ? 'Open' : a.phase === 'scheduled' ? 'Scheduled' : 'Closed'}`}
              backLabel="Class"
              actions={
                a.status === 'draft' ? (
                  <Button variant="primary" onClick={() => void publish(true)} loading={busy === 'publish'}>
                    Publish
                  </Button>
                ) : (
                  <Button onClick={() => void publish(false)} loading={busy === 'publish'}>
                    Unpublish
                  </Button>
                )
              }
            />
            <ErrorNote error={error} />
            {a.unreviewedAiItems ? <Banner tone="warn">{a.unreviewedAiItems} AI-drafted question(s) still need your review before you can publish.</Banner> : null}
            <Tabs
              label="Assessment sections"
              value={tab}
              onChange={(v) => {
          setTab(v);
          rememberTab(v);
        }}
              tabs={[
                { value: 'questions', label: 'Questions' },
                { value: 'settings', label: 'Settings' },
                { value: 'submissions', label: `Submissions${a.toGrade ? ` (${a.toGrade} to mark)` : ''}` },
                { value: 'overview', label: 'Class overview' },
              ]}
            />
            {tab === 'questions' ? <Questions a={a} reload={reload} /> : tab === 'settings' ? <SettingsTab a={a} onSaved={(n) => (q.set(() => n), refresh(`/classes/${a.classId}/assessments`))} /> : tab === 'submissions' ? <Submissions a={a} /> : <Overview a={a} />}
          </div>
        );
      }}
    </Loaded>
  );
}

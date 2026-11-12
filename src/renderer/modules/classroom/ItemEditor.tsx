import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Block, ItemDto, Question } from '../../../shared/classroom/protocol';
import { Button, Field, Input, Modal, Select, Textarea, Toggle } from '../../components/ui';
import { ErrorNote } from './common';
import { useAction } from './context';

export const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Multiple choice',
  multiple_select: 'Choose all that apply',
  true_false: 'True or false',
  numeric: 'Number',
  expression: 'Expression',
  short_answer: 'Short answer',
  fill_blank: 'Fill in the blanks',
  matching: 'Matching',
  ordering: 'Put in order',
  written: 'Written answer',
};

interface Form {
  type: string;
  prompt: string;
  /** Only when the prompt has blocks the plain-text editor cannot show (math, tables, diagrams). */
  promptBlocks: Block[] | null;
  choices: string[];
  answer: number;
  answers: number[];
  bool: boolean;
  text: string;
  tolerance: string;
  unit: string;
  lines: string;
  hints: string;
  solution: string;
  sample: string;
  minWords: number;
  points: number;
  long: boolean;
}

const blocksText = (b: Block[]) => (b.every((x) => x.kind === 'p') ? { text: b.map((x) => (x as { text: string }).text).join('\n\n'), blocks: null } : { text: '', blocks: b });
const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function formOf(item: ItemDto | null): Form {
  const base: Form = { type: 'multiple_choice', prompt: '', promptBlocks: null, choices: ['', '', '', ''], answer: 0, answers: [], bool: true, text: '', tolerance: '', unit: '', lines: '', hints: '', solution: '', sample: '', minWords: 0, points: 1, long: false };
  if (!item) return base;
  const q = item.question;
  const p = blocksText(q.prompt);
  const f: Form = { ...base, type: q.type, prompt: p.text, promptBlocks: p.blocks, hints: q.hints.join('\n'), solution: blocksText(q.solution).text, points: item.points, long: item.long };
  switch (q.type) {
    case 'multiple_choice':
      return { ...f, choices: q.choices.map((c) => c.text), answer: Math.max(0, q.choices.findIndex((c) => c.id === q.answer)) };
    case 'multiple_select':
      return { ...f, choices: q.choices.map((c) => c.text), answers: q.answers.map((a) => q.choices.findIndex((c) => c.id === a)).filter((i) => i >= 0) };
    case 'true_false':
      return { ...f, bool: q.answer };
    case 'numeric':
      return { ...f, text: q.answer, tolerance: q.tolerance ?? '', unit: q.unit ?? '' };
    case 'expression':
      return { ...f, text: q.answer, lines: q.variables.join(', ') };
    case 'short_answer':
      return { ...f, lines: q.accepted.join('\n'), text: (q.keywords ?? []).join(', ') };
    case 'fill_blank':
      return { ...f, text: q.template, lines: q.blanks.map((b) => b.accepted.join(' | ')).join('\n') };
    case 'matching':
      return { ...f, lines: q.left.map((l) => `${l.text} = ${q.right.find((r) => r.id === q.pairs[l.id])?.text ?? ''}`).join('\n') };
    case 'ordering':
      return { ...f, lines: q.order.map((id) => q.items.find((i) => i.id === id)?.text ?? '').join('\n') };
    case 'written':
      return { ...f, sample: q.sampleAnswer ?? '', minWords: q.minWords ?? 0 };
    default:
      return f;
  }
}

/** The teacher's form as the server's question format (see src/shared/classroom/items.ts). */
function questionOf(f: Form, existing: Question | null): Record<string, unknown> {
  const prompt = f.promptBlocks ?? f.prompt;
  const common = { prompt, hints: lines(f.hints), solution: f.solution };
  switch (f.type) {
    case 'multiple_choice':
      return { ...common, type: f.type, choices: f.choices.map((c) => c.trim()).filter(Boolean), answer: f.answer };
    case 'multiple_select':
      return { ...common, type: f.type, choices: f.choices.map((c) => c.trim()).filter(Boolean), answers: f.answers };
    case 'true_false':
      return { ...common, type: f.type, answer: f.bool };
    case 'numeric':
      return { ...common, type: f.type, answer: f.text, tolerance: f.tolerance || null, unit: f.unit || null };
    case 'expression':
      return { ...common, type: f.type, answer: f.text, variables: f.lines.split(/[,\s]+/).filter(Boolean) };
    case 'short_answer':
      return { ...common, type: f.type, accepted: lines(f.lines), keywords: f.text.split(',').map((k) => k.trim()).filter(Boolean) };
    case 'fill_blank':
      return { ...common, type: f.type, template: f.text, blanks: lines(f.lines).map((l) => ({ accepted: l.split('|').map((a) => a.trim()).filter(Boolean), numeric: false })) };
    case 'matching':
      return { ...common, type: f.type, pairs: lines(f.lines).map((l) => ({ left: l.split('=')[0]!.trim(), right: l.split('=').slice(1).join('=').trim() })) };
    case 'ordering':
      return { ...common, type: f.type, items: lines(f.lines) };
    default:
      return { ...common, type: 'written', sampleAnswer: f.sample || null, minWords: f.minWords, ...(existing?.type === 'written' ? { rubric: existing.rubric } : {}) };
  }
}

export function ItemEditor({ assessmentId, item, onClose, onSaved }: { assessmentId: string; item: ItemDto | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(() => formOf(item));
  const { run, busy, error } = useAction();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const choiceType = f.type === 'multiple_choice' || f.type === 'multiple_select';
  const save = async () => {
    const body = { points: f.points, long: f.type === 'written' && f.long, question: questionOf(f, item?.question ?? null) };
    const r = item ? await run('save', 'PATCH', `/assessments/${assessmentId}/items/${item.id}`, body) : await run('save', 'POST', `/assessments/${assessmentId}/items`, body);
    if (r) onSaved();
  };
  return (
    <Modal
      wide
      title={item ? `Edit question ${item.position}` : 'New question'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={busy === 'save'}>
            {item?.aiDrafted && !item.reviewed ? 'Save and accept' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="stack-3">
        {item?.aiDrafted ? <p className="small muted">Drafted by AI. Check the question and its answer key; saving it counts as your review.</p> : null}
        <div className="field-row">
          <Field label="Type" htmlFor="it-type">
            <Select id="it-type" value={f.type} onChange={(e) => set('type', e.target.value)} disabled={!!item}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Points" htmlFor="it-points">
            <Input id="it-points" type="number" min={0} max={100} step={0.5} value={f.points} onChange={(e) => set('points', Number(e.target.value) || 0)} style={{ maxWidth: 100 }} />
          </Field>
        </div>
        {f.promptBlocks ? (
          <p className="small muted">This question has formatting (math, a table or a diagram) that the editor cannot change. You can still change its answer and points.</p>
        ) : (
          <Field label="Question" htmlFor="it-prompt" hint="Plain text. Put maths between $$ signs, e.g. $$x^2$$. A blank line starts a new paragraph.">
            <Textarea id="it-prompt" rows={3} value={f.prompt} onChange={(e) => set('prompt', e.target.value)} />
          </Field>
        )}
        {choiceType ? (
          <fieldset className="stack-2">
            <legend>{f.type === 'multiple_choice' ? 'Choices (select the correct one)' : 'Choices (tick every correct one)'}</legend>
            {f.choices.map((c, i) => (
              <div key={i} className="row">
                <input
                  type={f.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                  name="correct"
                  aria-label={`Choice ${i + 1} is correct`}
                  checked={f.type === 'multiple_choice' ? f.answer === i : f.answers.includes(i)}
                  onChange={(e) => (f.type === 'multiple_choice' ? set('answer', i) : set('answers', e.target.checked ? [...f.answers, i] : f.answers.filter((x) => x !== i)))}
                />
                <Input aria-label={`Choice ${i + 1}`} value={c} onChange={(e) => set('choices', f.choices.map((x, j) => (j === i ? e.target.value : x)))} />
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={`Remove choice ${i + 1}`} disabled={f.choices.length <= 2} onClick={() => set('choices', f.choices.filter((_, j) => j !== i))} />
              </div>
            ))}
            <div>
              <Button size="sm" icon={<Plus size={14} />} disabled={f.choices.length >= 8} onClick={() => set('choices', [...f.choices, ''])}>
                Add choice
              </Button>
            </div>
          </fieldset>
        ) : null}
        {f.type === 'true_false' ? (
          <Field label="Correct answer" htmlFor="it-bool">
            <Select id="it-bool" value={String(f.bool)} onChange={(e) => set('bool', e.target.value === 'true')}>
              <option value="true">True</option>
              <option value="false">False</option>
            </Select>
          </Field>
        ) : null}
        {f.type === 'numeric' ? (
          <div className="field-row">
            <Field label="Answer" htmlFor="it-num" hint="Fractions and mixed numbers work, e.g. 3/4 or 1 1/2.">
              <Input id="it-num" value={f.text} onChange={(e) => set('text', e.target.value)} />
            </Field>
            <Field label="Allowed difference" htmlFor="it-tol" hint="e.g. 0.01">
              <Input id="it-tol" value={f.tolerance} onChange={(e) => set('tolerance', e.target.value)} />
            </Field>
            <Field label="Unit" htmlFor="it-unit">
              <Input id="it-unit" value={f.unit} onChange={(e) => set('unit', e.target.value)} />
            </Field>
          </div>
        ) : null}
        {f.type === 'expression' ? (
          <div className="field-row">
            <Field label="Answer" htmlFor="it-expr" hint="Any equivalent expression is marked right, e.g. 2(x+1) for 2x+2.">
              <Input id="it-expr" value={f.text} onChange={(e) => set('text', e.target.value)} />
            </Field>
            <Field label="Variables" htmlFor="it-vars">
              <Input id="it-vars" value={f.lines} onChange={(e) => set('lines', e.target.value)} placeholder="x" />
            </Field>
          </div>
        ) : null}
        {f.type === 'short_answer' ? (
          <>
            <Field label="Accepted answers (one per line)" htmlFor="it-acc" hint="Case and extra spaces are ignored.">
              <Textarea id="it-acc" rows={3} value={f.lines} onChange={(e) => set('lines', e.target.value)} />
            </Field>
            <Field label="Or accept any answer containing all of these words (comma separated)" htmlFor="it-kw">
              <Input id="it-kw" value={f.text} onChange={(e) => set('text', e.target.value)} />
            </Field>
          </>
        ) : null}
        {f.type === 'fill_blank' ? (
          <>
            <Field label="Sentence with blanks" htmlFor="it-tpl" hint="Write ___ (three underscores) for each blank.">
              <Input id="it-tpl" value={f.text} onChange={(e) => set('text', e.target.value)} />
            </Field>
            <Field label="Answers, one line per blank" htmlFor="it-blanks" hint="Separate alternatives with |, e.g. mitochondria | mitochondrion">
              <Textarea id="it-blanks" rows={3} value={f.lines} onChange={(e) => set('lines', e.target.value)} />
            </Field>
          </>
        ) : null}
        {f.type === 'matching' ? (
          <Field label="Pairs, one per line" htmlFor="it-pairs" hint="left = right, e.g. Nucleus = holds DNA. The right side is shuffled for students.">
            <Textarea id="it-pairs" rows={4} value={f.lines} onChange={(e) => set('lines', e.target.value)} />
          </Field>
        ) : null}
        {f.type === 'ordering' ? (
          <Field label="Items in the correct order, one per line" htmlFor="it-order" hint="Students see them shuffled.">
            <Textarea id="it-order" rows={4} value={f.lines} onChange={(e) => set('lines', e.target.value)} />
          </Field>
        ) : null}
        {f.type === 'written' ? (
          <>
            <Field label="Notes for marking (students never see these)" htmlFor="it-sample" hint="A model answer or what you look for. Used when an AI suggests a mark.">
              <Textarea id="it-sample" rows={3} value={f.sample} onChange={(e) => set('sample', e.target.value)} />
            </Field>
            <div className="field-row">
              <Field label="Minimum words" htmlFor="it-min">
                <Input id="it-min" type="number" min={0} max={2000} value={f.minWords} onChange={(e) => set('minWords', Math.max(0, Number(e.target.value) || 0))} style={{ maxWidth: 120 }} />
              </Field>
            </div>
            <Toggle checked={f.long} onChange={(v) => set('long', v)} label="Long answer (a larger writing area)" />
          </>
        ) : null}
        <Field label="Hints (optional, one per line)" htmlFor="it-hints" hint="Shown only in practice quizzes.">
          <Textarea id="it-hints" rows={2} value={f.hints} onChange={(e) => set('hints', e.target.value)} />
        </Field>
        <Field label="Explanation shown with results (optional)" htmlFor="it-sol">
          <Textarea id="it-sol" rows={2} value={f.solution} onChange={(e) => set('solution', e.target.value)} />
        </Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

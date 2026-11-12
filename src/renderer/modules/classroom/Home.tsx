import { Archive, Plus, School, Settings2, Users } from 'lucide-react';
import { useState } from 'react';
import type { ClassDto } from '../../../shared/classroom/protocol';
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Toggle } from '../../components/ui';
import { ErrorNote, Loaded, PageHeader, ROLE_LABEL, plural } from './common';
import { useAction, useClassroom, useGet } from './context';

export function ClassForm({ initial, onDone, onCancel }: { initial?: ClassDto; onDone: (c: ClassDto) => void; onCancel: () => void }) {
  const { run, busy, error } = useAction();
  const courses = useGet<{ id: string; label: string; grades: number[] }[]>('/curriculum/courses');
  const [f, setF] = useState({
    name: initial?.name ?? '',
    section: initial?.section ?? '',
    schoolYear: initial?.schoolYear ?? '',
    courseId: initial?.courseId ?? '',
    endsOn: initial?.endsOn ?? '',
    mayIncludeUnder13: initial?.mayIncludeUnder13 ?? false,
  });
  const save = async () => {
    const course = courses.data?.find((c) => c.id === f.courseId) ?? null;
    const body = { name: f.name, section: f.section, schoolYear: f.schoolYear, courseId: course?.id ?? null, courseLabel: course?.label ?? null, endsOn: f.endsOn || null, mayIncludeUnder13: f.mayIncludeUnder13 };
    const r = initial ? await run<ClassDto>('save', 'PATCH', `/classes/${initial.id}`, body) : await run<ClassDto>('save', 'POST', '/classes', body);
    if (r) onDone(r);
  };
  return (
    <Modal
      title={initial ? 'Class details' : 'New class'}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" loading={busy === 'save'} disabled={!f.name.trim()} onClick={save}>
            {initial ? 'Save' : 'Create class'}
          </Button>
        </>
      }
    >
      <div className="stack-3">
        <Field label="Class name" htmlFor="cf-name">
          <Input id="cf-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Grade 9 Science" required />
        </Field>
        <div className="field-row">
          <Field label="Section" htmlFor="cf-sec">
            <Input id="cf-sec" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} placeholder="Period 2" />
          </Field>
          <Field label="School year" htmlFor="cf-year">
            <Input id="cf-year" value={f.schoolYear} onChange={(e) => setF({ ...f, schoolYear: e.target.value })} placeholder="2026–27" />
          </Field>
        </div>
        <Field label="Ontario course (optional)" htmlFor="cf-course" hint="Lets you tag questions with curriculum expectations.">
          <Select id="cf-course" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
            <option value="">No course</option>
            {(courses.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Last day of class" htmlFor="cf-end" hint="The school’s retention period counts from this day; after it, the class and its work are deleted.">
          <Input id="cf-end" type="date" value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} />
        </Field>
        <Toggle
          checked={f.mayIncludeUnder13}
          onChange={(v) => setF({ ...f, mayIncludeUnder13: v })}
          label="Some students may be under 13"
          description="Students can join only after an administrator confirms the school has the consent it needs (School settings)."
        />
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

function JoinAnother({ onDone }: { onDone: () => void }) {
  const { run, busy, error } = useAction();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const join = async () => {
    const r = await run<{ className: string; status: string }>('join', 'POST', '/join', { code: code.trim() });
    if (r) {
      setMsg(r.status === 'pending' ? `Asked to join ${r.className}. Your teacher needs to approve you.` : `Joined ${r.className}.`);
      setCode('');
      onDone();
    }
  };
  return (
    <div className="card stack-2" style={{ maxWidth: 480 }}>
      <h2 className="h2">Join another class</h2>
      <div className="row">
        <Input aria-label="Class code" placeholder="Class code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
        <Button onClick={join} loading={busy === 'join'} disabled={code.trim().length < 4}>
          Join
        </Button>
      </div>
      {msg ? <p className="small" role="status">{msg}</p> : null}
      <ErrorNote error={error} />
    </div>
  );
}

export function Home() {
  const { me, go, refresh } = useClassroom();
  const classes = useGet<ClassDto[]>('/classes');
  const [creating, setCreating] = useState(false);
  const teacher = me.role !== 'student';
  return (
    <div className="stack-5">
      <header className="row-wrap" style={{ alignItems: 'flex-start' }}>
        <div className="grow stack-1">
          <h1>Classroom</h1>
          <p className="muted small">
            {me.displayName} · {ROLE_LABEL[me.role]} · {me.schoolName}
          </p>
        </div>
        <div className="row-wrap">
          {me.role === 'admin' ? (
            <Button icon={<Settings2 size={15} />} onClick={() => go({ v: 'admin' })}>
              School settings
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => go({ v: 'account' })}>
            My account
          </Button>
          {teacher ? (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              New class
            </Button>
          ) : null}
        </div>
      </header>
      <Loaded q={classes} label="Loading classes…">
        {(list) =>
          list.length === 0 ? (
            <EmptyState icon={<School size={28} />} title={teacher ? 'No classes yet' : 'You are not in a class yet'}>
              {teacher ? 'Create a class, then share its code with your students.' : 'Ask your teacher for a class code and enter it below.'}
            </EmptyState>
          ) : (
            <div className="grid grid-2">
              {list.map((c) => (
                <button key={c.id} type="button" className="card stack-2 interactive" style={{ textAlign: 'left' }} onClick={() => go({ v: 'class', id: c.id })}>
                  <div className="row">
                    <h2 className="h2 grow">{c.name}</h2>
                    {c.archived ? (
                      <Badge tone="outline">
                        <Archive size={12} aria-hidden /> Archived
                      </Badge>
                    ) : null}
                  </div>
                  <span className="small muted">{[c.section, c.schoolYear, c.courseLabel].filter(Boolean).join(' · ') || 'No details'}</span>
                  {c.myRole !== 'student' ? (
                    <span className="row small muted" style={{ gap: 6 }}>
                      <Users size={14} aria-hidden /> {plural(c.students, 'student')}
                      {c.pending ? <Badge tone="warn">{c.pending} waiting for approval</Badge> : null}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )
        }
      </Loaded>
      {!teacher ? <JoinAnother onDone={() => refresh('/classes')} /> : null}
      {creating ? (
        <ClassForm
          onCancel={() => setCreating(false)}
          onDone={(c) => {
            setCreating(false);
            refresh('/classes');
            go({ v: 'class', id: c.id });
          }}
        />
      ) : null}
    </div>
  );
}

export function Account() {
  const { me, t, signOut } = useClassroom();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const exportMine = async () => {
    setBusy(true);
    try {
      const data = await t.request<unknown>('GET', '/my/export');
      const saved = await t.saveText(`classroom-my-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      setMsg(saved ? 'Saved.' : null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack-4" style={{ maxWidth: 640 }}>
      <PageHeader title="My account" />
      <div className="card stack-2">
        <div>
          <strong>{me.displayName}</strong> · {ROLE_LABEL[me.role]}
        </div>
        <div className="small muted">
          {me.login} · {me.schoolName}
        </div>
      </div>
      {me.role === 'student' ? (
        <div className="card stack-2">
          <h2 className="h2">Your data</h2>
          <p className="small muted">Download everything this classroom server holds about you: your classes, answers, AI chats, marks and feedback that have been released, and the activity recorded during assessments.</p>
          <div>
            <Button onClick={exportMine} loading={busy}>
              Download my data
            </Button>
          </div>
          {msg ? (
            <p className="small" role="status">
              {msg}
            </p>
          ) : null}
        </div>
      ) : null}
      <div>
        <Button variant="danger" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

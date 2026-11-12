import { Copy, Download, FileText, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { ASSESSMENT_KIND_LABEL, MATERIAL_TYPES, MAX_MATERIAL_BYTES, type Accommodation, type AssessmentDto, type ClassDto, type GradebookDto, type JoinCodeDto, type MaterialDto, type MemberDto, type RosterResult } from '../../../shared/classroom/protocol';
import { Badge, Banner, Button, EmptyState, Field, Input, Modal, Tabs, Textarea, Toggle, useConfirm } from '../../components/ui';
import { ErrorNote, Loaded, PageHeader, fmtDate, fmtDateTime, plural, pts } from './common';
import { useAction, useClassroom, useGet, useTransport } from './context';
import { ClassForm } from './Home';

type Tab = 'assessments' | 'materials' | 'students' | 'gradebook' | 'details';

const PHASE: Record<AssessmentDto['phase'], { label: string; tone: 'outline' | 'info' | 'ok' | 'warn' }> = {
  draft: { label: 'Draft', tone: 'outline' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  open: { label: 'Open', tone: 'ok' },
  closed: { label: 'Closed', tone: 'warn' },
};

function Assessments({ cls }: { cls: ClassDto }) {
  const { go, refresh } = useClassroom();
  const list = useGet<AssessmentDto[]>(`/classes/${cls.id}/assessments`);
  const { run, busy, error } = useAction();
  const [title, setTitle] = useState('');
  const [copyFrom, setCopyFrom] = useState(false);
  const create = async () => {
    const a = await run<AssessmentDto>('create', 'POST', `/classes/${cls.id}/assessments`, { title: title.trim() });
    if (a) {
      setTitle('');
      refresh(`/classes/${cls.id}/assessments`);
      go({ v: 'assessment', id: a.id, tab: 'questions' });
    }
  };
  return (
    <div className="stack-4">
      <div className="card stack-2">
        <h2 className="h2">New assessment</h2>
        <div className="row-wrap">
          <Input aria-label="Assessment title" placeholder="Title, e.g. Cells quiz" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && title.trim() && void create()} style={{ maxWidth: 360 }} />
          <Button variant="primary" icon={<Plus size={15} />} onClick={create} loading={busy === 'create'} disabled={!title.trim()}>
            Create
          </Button>
          <Button variant="ghost" icon={<Copy size={15} />} onClick={() => setCopyFrom(true)}>
            Copy from another class
          </Button>
        </div>
        <ErrorNote error={error} />
      </div>
      <Loaded q={list}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState title="No assessments yet">Create a quiz, test or written assignment. It stays a draft until you publish it.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Assessment</th>
                    <th scope="col">Status</th>
                    <th scope="col">Questions</th>
                    <th scope="col">Submitted</th>
                    <th scope="col">To mark</th>
                    <th scope="col">Closes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <button type="button" className="link-button" onClick={() => go({ v: 'assessment', id: a.id })}>
                          {a.title}
                        </button>
                        <div className="tiny faint">{ASSESSMENT_KIND_LABEL[a.settings.kind]}</div>
                      </td>
                      <td>
                        <Badge tone={PHASE[a.phase].tone}>{PHASE[a.phase].label}</Badge>
                        {a.unreviewedAiItems ? <div className="tiny" style={{ color: 'var(--warn)' }}>{a.unreviewedAiItems} AI-drafted not reviewed</div> : null}
                      </td>
                      <td>
                        {a.items} · {pts(a.points)} pts
                      </td>
                      <td>{a.submissions ?? 0}</td>
                      <td>{a.toGrade ? <Badge tone="warn">{a.toGrade}</Badge> : '0'}</td>
                      <td className="small">{fmtDateTime(a.settings.closesAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {copyFrom ? <CopyAssessments cls={cls} onClose={() => setCopyFrom(false)} /> : null}
    </div>
  );
}

function CopyAssessments({ cls, onClose }: { cls: ClassDto; onClose: () => void }) {
  const { refresh } = useClassroom();
  const classes = useGet<ClassDto[]>('/classes');
  const { run, busy, error } = useAction();
  const [from, setFrom] = useState('');
  const copy = async () => {
    const r = await run<{ copied: number }>('copy', 'POST', `/classes/${cls.id}/copy-assessments`, { fromClassId: from });
    if (r) {
      refresh(`/classes/${cls.id}/assessments`);
      onClose();
    }
  };
  const others = (classes.data ?? []).filter((c) => c.id !== cls.id && c.myRole !== 'student');
  return (
    <Modal
      title="Copy assessments from another class"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={copy} loading={busy === 'copy'} disabled={!from}>
            Copy as drafts
          </Button>
        </>
      }
    >
      <div className="stack-3">
        <p className="small muted">Every assessment and its questions is copied as a draft, without dates. Materials are not copied; attach this class’s materials afterwards. Student work is never copied.</p>
        <div className="stack-1" role="radiogroup" aria-label="Copy from">
          {others.length === 0 ? <p className="small muted">You have no other classes.</p> : null}
          {others.map((c) => (
            <label key={c.id} className={`choice ${from === c.id ? 'selected' : ''}`}>
              <input type="radio" name="copy-from" checked={from === c.id} onChange={() => setFrom(c.id)} />
              <span>
                {c.name} {c.section ? <span className="muted">· {c.section}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

const ACCEPT = Object.keys(MATERIAL_TYPES)
  .map((e) => `.${e}`)
  .join(',');
const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Materials({ cls }: { cls: ClassDto }) {
  const t = useTransport();
  const { refresh } = useClassroom();
  const confirm = useConfirm();
  const list = useGet<MaterialDto[]>(`/classes/${cls.id}/materials`);
  const input = useRef<HTMLInputElement>(null);
  const replaceFor = useRef<MaterialDto | null>(null);
  const [rights, setRights] = useState(false);
  const [folder, setFolder] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ m: MaterialDto; page: number; text: string | null } | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const target = replaceFor.current;
    replaceFor.current = null;
    const errs: string[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_MATERIAL_BYTES) {
        errs.push(`${f.name}: larger than ${MAX_MATERIAL_BYTES / 1024 / 1024} MB.`);
        continue;
      }
      setBusy(`Uploading ${f.name}…`);
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        await t.upload(target ? `/materials/${target.id}/content` : `/classes/${cls.id}/materials`, { folder }, { name: target ? target.name : f.name, type: f.type || 'application/octet-stream', bytes });
      } catch (e) {
        errs.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(null);
    setErrors(errs);
    if (input.current) input.current.value = '';
    refresh(`/classes/${cls.id}/materials`);
  };
  const remove = async (m: MaterialDto) => {
    if (!(await confirm({ title: `Delete ${m.name}?`, message: 'Assessments that use it will no longer give it to the assistant. Past chats keep their citations as text.', confirmLabel: 'Delete', danger: true }))) return;
    await t.request('DELETE', `/materials/${m.id}`).catch((e: Error) => setErrors([e.message]));
    refresh(`/classes/${cls.id}/materials`);
  };
  const showPage = async (m: MaterialDto, page: number) => {
    setPreview({ m, page, text: null });
    const r = await t.request<{ text: string }>('GET', `/materials/${m.id}/pages/${page}`).catch(() => ({ text: '(This page could not be loaded.)' }));
    setPreview({ m, page, text: r.text || '(No text on this page.)' });
  };

  return (
    <div className="stack-4">
      <div className="card stack-3">
        <h2 className="h2">Add materials</h2>
        <p className="small muted">
          PDF, Word (.docx), PowerPoint (.pptx), text, Markdown and images, up to {MAX_MATERIAL_BYTES / 1024 / 1024} MB each. The assistant answers from these and cites the page it used. Files are checked before they are stored; text is read from them on the server. Scanned
          pages without a text layer are stored but cannot be searched.
        </p>
        <div className="field-row">
          <Field label="Folder (optional)" htmlFor="mat-folder">
            <Input id="mat-folder" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Unit 3" />
          </Field>
        </div>
        <Toggle checked={rights} onChange={setRights} label="I have the right to share these files with my class" description="For example, you made them, your school licenses them, or the licence allows classroom use." />
        <div className="row-wrap">
          <Button icon={<Upload size={15} />} disabled={!rights || !!busy} onClick={() => input.current?.click()}>
            Choose files
          </Button>
          {busy ? (
            <span className="small" role="status">
              {busy}
            </span>
          ) : null}
        </div>
        <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => void upload(e.target.files)} aria-label="Material files" />
        {errors.length ? (
          <Banner tone="danger" title="Some files were not added">
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Banner>
        ) : null}
      </div>
      <Loaded q={list}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState icon={<FileText size={26} />} title="No materials yet">
              Upload notes, readings or slides for the assistant to use.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">File</th>
                    <th scope="col">Folder</th>
                    <th scope="col">Pages</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {m.pages ? (
                          <button type="button" className="link-button" onClick={() => void showPage(m, 1)}>
                            {m.name}
                          </button>
                        ) : (
                          m.name
                        )}
                        <div className="tiny faint">
                          {size(m.size)} · version {m.version}
                        </div>
                      </td>
                      <td className="small">{m.folder || '—'}</td>
                      <td>{m.pages || '—'}</td>
                      <td>
                        {m.status === 'ready' ? <Badge tone="ok">Text read</Badge> : <Badge tone="warn" title={m.statusDetail}>No text</Badge>}
                        <div className="tiny faint" title={m.scan}>
                          {m.statusDetail}
                        </div>
                      </td>
                      <td className="small">{fmtDate(m.updatedAt)}</td>
                      <td>
                        <div className="row">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<RefreshCw size={14} />}
                            disabled={!rights}
                            title={rights ? 'Upload a new version' : 'Confirm you have the right to share files first'}
                            onClick={() => {
                              replaceFor.current = m;
                              input.current?.click();
                            }}
                          >
                            Replace
                          </Button>
                          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => void remove(m)} aria-label={`Delete ${m.name}`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {preview ? (
        <Modal
          wide
          title={`${preview.m.name} · page ${preview.page} of ${preview.m.pages}`}
          onClose={() => setPreview(null)}
          footer={
            <>
              <Button disabled={preview.page <= 1} onClick={() => void showPage(preview.m, preview.page - 1)}>
                Previous page
              </Button>
              <Button disabled={preview.page >= preview.m.pages} onClick={() => void showPage(preview.m, preview.page + 1)}>
                Next page
              </Button>
            </>
          }
        >
          <p className="small muted">The text the assistant reads from this page.</p>
          <pre className="material-text">{preview.text ?? 'Loading…'}</pre>
        </Modal>
      ) : null}
    </div>
  );
}

function AccommodationEditor({ cls, m, value, onClose }: { cls: ClassDto; m: MemberDto; value: Accommodation | undefined; onClose: () => void }) {
  const { refresh } = useClassroom();
  const { run, busy, error } = useAction();
  const [a, setA] = useState<Accommodation>(value ?? { extraTimePercent: 0, pasteAllowed: false, textToSpeech: false, largerText: false, note: '' });
  const save = async () => {
    if (await run('save', 'PUT', `/classes/${cls.id}/accommodations/${m.userId}`, a)) {
      refresh(`/classes/${cls.id}/accommodations`);
      onClose();
    }
  };
  return (
    <Modal
      title={`Accommodations for ${m.displayName}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={busy === 'save'}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack-3">
        <p className="small muted">These apply to every assessment in this class. They are never shown as flags or counted against the student; the student sees their own accommodations before starting.</p>
        <Field label="Extra time (%)" htmlFor="acc-time" hint="50 means time and a half. Applied when the student starts; closing times still apply.">
          <Input id="acc-time" type="number" min={0} max={300} step={5} value={a.extraTimePercent} onChange={(e) => setA({ ...a, extraTimePercent: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })} style={{ maxWidth: 120 }} />
        </Field>
        <Toggle checked={a.pasteAllowed} onChange={(v) => setA({ ...a, pasteAllowed: v })} label="Allow pasting into answers" description="For students who use assistive technology that types through the clipboard. Pastes are not recorded as events." />
        <Toggle checked={a.textToSpeech} onChange={(v) => setA({ ...a, textToSpeech: v })} label="Read questions aloud" description="Adds a “Read aloud” button to each question (uses the device’s speech voice)." />
        <Toggle checked={a.largerText} onChange={(v) => setA({ ...a, largerText: v })} label="Larger text" />
        <Field label="Private note (teachers only)" htmlFor="acc-note">
          <Textarea id="acc-note" rows={2} value={a.note} maxLength={300} onChange={(e) => setA({ ...a, note: e.target.value })} />
        </Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

function Roster({ cls, onClose }: { cls: ClassDto; onClose: () => void }) {
  const t = useTransport();
  const { refresh } = useClassroom();
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<RosterResult | null>(null);
  const { run, busy, error } = useAction();
  const preview = async (commit: boolean) => {
    const r = await run<RosterResult>(commit ? 'commit' : 'preview', 'POST', `/classes/${cls.id}/roster`, { csv, commit });
    if (r) {
      setResult(r);
      if (commit) refresh(`/classes/${cls.id}/members`, '/classes');
    }
  };
  const created = result?.committed ? result.rows.filter((r) => r.temporaryPassword) : [];
  return (
    <Modal
      wide
      title="Add students from a CSV roster"
      onClose={onClose}
      footer={
        result?.committed ? (
          <>
            {created.length ? (
              <Button icon={<Download size={14} />} onClick={() => void t.saveText(`${cls.name}-new-accounts.csv`, ['Name,Login,Temporary password', ...created.map((r) => `"${r.displayName.replace(/"/g, '""')}",${r.login},${r.temporaryPassword}`)].join('\n'), 'text/csv')}>
                Save passwords
              </Button>
            ) : null}
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button onClick={() => void preview(false)} loading={busy === 'preview'} disabled={!csv.trim()}>
              Check
            </Button>
            <Button variant="primary" onClick={() => void preview(true)} loading={busy === 'commit'} disabled={!result || result.errors > 0 || result.rows.length === 0}>
              Add {result ? plural(result.rows.length, 'student') : 'students'}
            </Button>
          </>
        )
      }
    >
      <div className="stack-3">
        <p className="small muted">Two columns: the student’s name, and their school email or username. Nothing is created until you check the list and press Add. New accounts get a password to hand out (there is no password change in this version, so keep it private).</p>
        {!result?.committed ? (
          <>
            <Textarea aria-label="Roster CSV" rows={8} value={csv} onChange={(e) => (setCsv(e.target.value), setResult(null))} placeholder={'name,email\nAna Lee,ana.lee@school.ca\nBen Roy,ben.roy@school.ca'} spellCheck={false} />
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Choose a CSV file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setCsv(await f.text());
                  setResult(null);
                }
              }}
            />
          </>
        ) : null}
        {result ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col">Name</th>
                  <th scope="col">Login</th>
                  <th scope="col">{result.committed ? 'Result' : 'Check'}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td>{r.displayName}</td>
                    <td>{r.login}</td>
                    <td>{r.error ? <span style={{ color: 'var(--danger)' }}>{r.error}</span> : r.temporaryPassword ? <code>{r.temporaryPassword}</code> : r.existing ? 'Existing account' : result.committed ? 'Added' : 'OK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {result?.committed ? <Banner tone="warn">These passwords are shown once. Save or hand them out now.</Banner> : null}
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

function Students({ cls }: { cls: ClassDto }) {
  const { refresh } = useClassroom();
  const confirm = useConfirm();
  const members = useGet<MemberDto[]>(`/classes/${cls.id}/members`);
  const code = useGet<JoinCodeDto | null>(`/classes/${cls.id}/join-code`);
  const acc = useGet<Record<string, Accommodation>>(`/classes/${cls.id}/accommodations`);
  const { run, busy, error } = useAction();
  const [editing, setEditing] = useState<MemberDto | null>(null);
  const [roster, setRoster] = useState(false);
  const [approval, setApproval] = useState(false);
  const [coLogin, setCoLogin] = useState('');
  const newCode = async () => {
    if (await run('code', 'POST', `/classes/${cls.id}/join-code`, { expiresInDays: 14, requireApproval: approval })) refresh(`/classes/${cls.id}/join-code`);
  };
  const act = async (m: MemberDto, action: 'approve' | 'remove') => {
    if (action === 'remove' && !(await confirm({ title: `Remove ${m.displayName}?`, message: 'They lose access to the class. Their submitted work stays with the class until it is deleted.', confirmLabel: 'Remove', danger: true }))) return;
    if (await run(action, 'POST', `/classes/${cls.id}/members/${m.userId}`, { action })) refresh(`/classes/${cls.id}/members`, '/classes');
  };
  const addCo = async () => {
    if (await run('co', 'POST', `/classes/${cls.id}/co-teachers`, { login: coLogin.trim() })) {
      setCoLogin('');
      refresh(`/classes/${cls.id}/members`);
    }
  };
  return (
    <div className="stack-4">
      <div className="grid grid-2">
        <div className="card stack-2">
          <h2 className="h2">Class code</h2>
          <Loaded q={code}>
            {(c) =>
              c ? (
                <>
                  <p className="class-code" aria-label={`Class code ${c.code.split('').join(' ')}`}>
                    {c.code}
                  </p>
                  <p className="small muted">
                    Students choose Join a class and enter this code. Expires {fmtDate(c.expiresAt)}.{c.requireApproval ? ' You approve each student.' : ''}
                  </p>
                </>
              ) : (
                <p className="small muted">No active code. Make one to let students join.</p>
              )
            }
          </Loaded>
          <Toggle checked={approval} onChange={setApproval} label="Approve each student before they can see the class" />
          <div className="row-wrap">
            <Button onClick={newCode} loading={busy === 'code'}>
              {code.data ? 'Make a new code' : 'Make a code'}
            </Button>
            {code.data ? (
              <Button variant="ghost" onClick={async () => (await run('stop', 'DELETE', `/classes/${cls.id}/join-code`)) && refresh(`/classes/${cls.id}/join-code`)}>
                Stop joining
              </Button>
            ) : null}
          </div>
        </div>
        <div className="card stack-2">
          <h2 className="h2">Add students</h2>
          <p className="small muted">Import a CSV of names and school emails or usernames. Accounts are created for students who do not have one.</p>
          <div>
            <Button icon={<Upload size={15} />} onClick={() => setRoster(true)}>
              Import roster
            </Button>
          </div>
          <h3 className="h2" style={{ marginTop: 8 }}>
            Co-teacher
          </h3>
          <div className="row">
            <Input aria-label="Co-teacher’s email or username" placeholder="Teacher’s email or username" value={coLogin} onChange={(e) => setCoLogin(e.target.value)} />
            <Button onClick={addCo} loading={busy === 'co'} disabled={coLogin.trim().length < 3}>
              Add
            </Button>
          </div>
        </div>
      </div>
      <ErrorNote error={error} />
      <Loaded q={members}>
        {(list) => {
          const people = list.filter((m) => m.status !== 'removed');
          return people.length === 0 ? (
            <EmptyState title="No students yet">Share the class code or import a roster.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Login</th>
                    <th scope="col">Role</th>
                    <th scope="col">Accommodations</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((m) => {
                    const a = acc.data?.[m.userId];
                    const summary = a ? [a.extraTimePercent ? `+${a.extraTimePercent}% time` : '', a.pasteAllowed ? 'paste allowed' : '', a.textToSpeech ? 'read aloud' : '', a.largerText ? 'larger text' : ''].filter(Boolean).join(', ') : '';
                    return (
                      <tr key={m.userId}>
                        <td>
                          {m.displayName} {m.status === 'pending' ? <Badge tone="warn">Waiting</Badge> : null}
                        </td>
                        <td className="small">{m.login}</td>
                        <td className="small">{m.role === 'student' ? 'Student' : m.role === 'teacher' ? 'Teacher' : 'Co-teacher'}</td>
                        <td className="small">{m.role === 'student' ? summary || '—' : ''}</td>
                        <td>
                          <div className="row">
                            {m.status === 'pending' ? (
                              <Button size="sm" variant="primary" onClick={() => void act(m, 'approve')}>
                                Approve
                              </Button>
                            ) : null}
                            {m.role === 'student' ? (
                              <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                                Accommodations
                              </Button>
                            ) : null}
                            {m.role !== 'teacher' ? (
                              <Button size="sm" variant="ghost" onClick={() => void act(m, 'remove')}>
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }}
      </Loaded>
      {editing ? <AccommodationEditor cls={cls} m={editing} value={acc.data?.[editing.userId]} onClose={() => setEditing(null)} /> : null}
      {roster ? <Roster cls={cls} onClose={() => setRoster(false)} /> : null}
    </div>
  );
}

const CELL: Record<string, string> = { not_started: 'Not started', in_progress: 'In progress', submitted: 'Submitted', graded: 'Graded', released: 'Released' };

function Gradebook({ cls }: { cls: ClassDto }) {
  const t = useTransport();
  const g = useGet<GradebookDto>(`/classes/${cls.id}/gradebook`);
  const [msg, setMsg] = useState<string | null>(null);
  const exportCsv = async () => {
    try {
      const r = await t.request<{ filename: string; csv: string }>('GET', `/classes/${cls.id}/gradebook/csv`);
      if (await t.saveText(r.filename, r.csv, 'text/csv')) setMsg('Saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Loaded q={g}>
      {(d) => (
        <div className="stack-3">
          <div className="row-wrap">
            <p className="small muted grow">Marks you have decided. AI suggestions are never counted here. Practice quizzes are included but ungraded.</p>
            <Button icon={<Download size={14} />} onClick={exportCsv}>
              Export CSV
            </Button>
            {msg ? (
              <span className="small" role="status">
                {msg}
              </span>
            ) : null}
          </div>
          {d.assessments.length === 0 || d.students.length === 0 ? (
            <EmptyState title="Nothing to show yet">The gradebook fills in as students submit work.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table gradebook">
                <caption className="sr-only">Gradebook for {cls.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    {d.assessments.map((a) => (
                      <th key={a.id} scope="col">
                        {a.title}
                        <div className="tiny faint">out of {pts(a.points)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.students.map((s) => (
                    <tr key={s.id}>
                      <th scope="row">{s.displayName}</th>
                      {d.assessments.map((a) => {
                        const c = d.cells[`${s.id}:${a.id}`];
                        return (
                          <td key={a.id}>
                            {c?.score !== null && c?.score !== undefined ? <strong>{pts(c.score)}</strong> : <span className="small muted">{CELL[c?.status ?? 'not_started']}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Loaded>
  );
}

function Details({ cls, reload }: { cls: ClassDto; reload: () => void }) {
  const { go, refresh } = useClassroom();
  const confirm = useConfirm();
  const { run, error } = useAction();
  const [editing, setEditing] = useState(false);
  const archive = async () => {
    if (await run('archive', 'POST', `/classes/${cls.id}/archive`, { archived: !cls.archived })) {
      reload();
      refresh('/classes');
    }
  };
  const del = async () => {
    if (!(await confirm({ title: `Delete ${cls.name}?`, message: 'This deletes the class, its materials, assessments, every student’s answers, chats and marks, now. It cannot be undone. Export the gradebook first if you need it.', confirmLabel: 'Delete class', danger: true }))) return;
    if (await run('delete', 'DELETE', `/classes/${cls.id}`)) {
      refresh('/classes');
      go({ v: 'home' });
    }
  };
  return (
    <div className="stack-4" style={{ maxWidth: 640 }}>
      <div className="card stack-2">
        <div className="row">
          <h2 className="h2 grow">Details</h2>
          <Button size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <dl className="details">
          <dt>Section</dt>
          <dd>{cls.section || '—'}</dd>
          <dt>School year</dt>
          <dd>{cls.schoolYear || '—'}</dd>
          <dt>Course</dt>
          <dd>{cls.courseLabel || '—'}</dd>
          <dt>Last day</dt>
          <dd>{cls.endsOn ? fmtDate(cls.endsOn) : 'Not set (retention counts from a year after the class was created)'}</dd>
          <dt>Under 13</dt>
          <dd>{cls.mayIncludeUnder13 ? 'May include students under 13' : 'No'}</dd>
        </dl>
      </div>
      <div className="card stack-2">
        <h2 className="h2">Archive or delete</h2>
        <p className="small muted">Archiving keeps everything but stops students joining or starting work. Deleting removes it all at once.</p>
        <div className="row-wrap">
          <Button onClick={archive}>{cls.archived ? 'Unarchive' : 'Archive class'}</Button>
          {cls.myRole === 'teacher' ? (
            <Button variant="danger" onClick={del}>
              Delete class
            </Button>
          ) : null}
        </div>
        <ErrorNote error={error} />
      </div>
      {editing ? (
        <ClassForm
          initial={cls}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            reload();
            refresh('/classes');
          }}
        />
      ) : null}
    </div>
  );
}

export function TeacherClass({ cls, reload, tab: initial }: { cls: ClassDto; reload: () => void; tab?: string }) {
  const { rememberTab } = useClassroom();
  const [tab, setTab] = useState<Tab>((initial as Tab) ?? 'assessments');
  return (
    <div className="stack-4">
      <PageHeader title={cls.name} subtitle={[cls.section, cls.schoolYear, cls.courseLabel, plural(cls.students, 'student')].filter(Boolean).join(' · ')} backLabel="All classes" />
      {cls.archived ? <Banner tone="warn">This class is archived. Students cannot join or start work.</Banner> : null}
      {cls.pending ? <Banner tone="info">{plural(cls.pending, 'student is', 'students are')} waiting for you to approve them (Students tab).</Banner> : null}
      <Tabs
        label="Class sections"
        value={tab}
        onChange={(v) => {
          setTab(v);
          rememberTab(v);
        }}
        tabs={[
          { value: 'assessments', label: 'Assessments' },
          { value: 'materials', label: 'Materials' },
          { value: 'students', label: 'Students' },
          { value: 'gradebook', label: 'Gradebook' },
          { value: 'details', label: 'Details' },
        ]}
      />
      {tab === 'assessments' ? <Assessments cls={cls} /> : tab === 'materials' ? <Materials cls={cls} /> : tab === 'students' ? <Students cls={cls} /> : tab === 'gradebook' ? <Gradebook cls={cls} /> : <Details cls={cls} reload={reload} />}
    </div>
  );
}

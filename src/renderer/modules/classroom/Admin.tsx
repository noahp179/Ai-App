import { KeyRound, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { AuditEntryDto, SchoolAdminDto, SchoolSettings, UsageRowDto } from '../../../shared/classroom/protocol';
import { Badge, Banner, Button, Field, Input, ProgressBar, Select, Tabs, Toggle, useConfirm } from '../../components/ui';
import { ErrorNote, Loaded, PageHeader, ROLE_LABEL, fmtDate, fmtDateTime } from './common';
import { useAction, useClassroom, useGet } from './context';

type Tab = 'settings' | 'teachers' | 'usage' | 'audit';
const money = (n: number) => `$${n.toFixed(n < 10 ? 2 : 0)}`;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

function SettingsForm({ d, onSaved }: { d: SchoolAdminDto; onSaved: (d: SchoolAdminDto) => void }) {
  const { run, busy, error } = useAction();
  const confirm = useConfirm();
  const [s, setS] = useState<SchoolSettings>(d.settings);
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const set = <K extends keyof SchoolSettings>(k: K, v: SchoolSettings[K]) => (setS((p) => ({ ...p, [k]: v })), setSaved(null));
  const save = async (extra: Record<string, unknown> = {}, label = 'Saved.') => {
    const r = await run<SchoolAdminDto>('save', 'PATCH', '/admin/school', { ...s, ...extra });
    if (r) {
      onSaved(r);
      setSaved(label);
      setKey('');
    }
  };
  return (
    <div className="stack-4" style={{ maxWidth: 760 }}>
      <section className="card stack-3" aria-labelledby="ad-ai">
        <h2 className="h2" id="ad-ai">
          AI
        </h2>
        <p className="small">
          AI key: {d.aiKey.set ? <Badge tone="ok">Set ({d.aiKey.hint})</Badge> : d.aiKey.source === 'server' ? <Badge tone="info">Using the server’s key</Badge> : <Badge tone="warn">Not set</Badge>}
        </p>
        <p className="small muted">The key is stored encrypted on the classroom server and only ever used there. It is never sent to teachers’ or students’ devices, and it cannot be shown again after saving.</p>
        <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
          <Field label="Anthropic API key" htmlFor="ad-key">
            <Input id="ad-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" style={{ minWidth: 280 }} />
          </Field>
          <Button icon={<KeyRound size={14} />} onClick={() => void save({ aiKey: key.trim() }, 'Key saved.')} disabled={key.trim().length < 20} loading={busy === 'save'}>
            Save key
          </Button>
          {d.aiKey.set ? (
            <Button variant="ghost" onClick={async () => (await confirm({ title: 'Remove the AI key?', message: 'The assistant and AI suggestions stop working until a key is added again.', confirmLabel: 'Remove', danger: true })) && void save({ aiKey: null }, 'Key removed.')}>
              Remove key
            </Button>
          ) : null}
        </div>
        <div className="field-row">
          <Field label="Model" htmlFor="ad-model">
            <Input id="ad-model" value={s.aiModel} onChange={(e) => set('aiModel', e.target.value)} />
          </Field>
          <Field label="Assistant effort" htmlFor="ad-ae" hint="Higher thinks longer and costs more.">
            <Select id="ad-ae" value={s.assistantEffort} onChange={(e) => set('assistantEffort', e.target.value as SchoolSettings['assistantEffort'])}>
              {EFFORTS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <Field label="Grading effort" htmlFor="ad-ge">
            <Select id="ad-ge" value={s.gradingEffort} onChange={(e) => set('gradingEffort', e.target.value as SchoolSettings['gradingEffort'])}>
              {EFFORTS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
        </div>
      </section>
      <section className="card stack-3" aria-labelledby="ad-budget">
        <h2 className="h2" id="ad-budget">
          Budget
        </h2>
        <ProgressBar value={d.usage.budget ? Math.min(1, d.usage.cost / d.usage.budget) : 0} label="AI spending this month" />
        <p className="small">
          {d.usage.month}: about {money(d.usage.cost)}
          {d.usage.budget !== null ? ` of ${money(d.usage.budget)}` : ''} · {d.usage.requests} requests{' '}
          {d.usage.state === 'paused' ? <Badge tone="danger">Assistant paused</Badge> : d.usage.state === 'warning' ? <Badge tone="warn">Over 80%</Badge> : null}
        </p>
        <p className="small muted">An estimate from token counts and the prices below; your provider’s invoice is the real figure. When the budget is used up the assistant pauses (students are told) and AI suggestions wait until there is budget again. Answers are never affected.</p>
        <Field label="Monthly budget (US$)" htmlFor="ad-bud" hint="Empty: no limit.">
          <Input id="ad-bud" type="number" min={0} step={1} value={s.monthlyBudget ?? ''} onChange={(e) => set('monthlyBudget', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} style={{ maxWidth: 140 }} />
        </Field>
        <div className="field-row">
          {(['input', 'output', 'cacheRead', 'cacheWrite'] as const).map((p) => (
            <Field key={p} label={`${{ input: 'Input', output: 'Output', cacheRead: 'Cache read', cacheWrite: 'Cache write' }[p]} ($/M tokens)`} htmlFor={`ad-p-${p}`}>
              <Input id={`ad-p-${p}`} type="number" min={0} step={0.01} value={s.prices[p]} onChange={(e) => set('prices', { ...s.prices, [p]: Math.max(0, Number(e.target.value)) })} style={{ maxWidth: 120 }} />
            </Field>
          ))}
        </div>
      </section>
      <section className="card stack-3" aria-labelledby="ad-priv">
        <h2 className="h2" id="ad-priv">
          Privacy and retention
        </h2>
        <Field label="Keep class data for (days after the class ends)" htmlFor="ad-ret" hint="Then the class, its materials, answers, chats and marks are deleted automatically.">
          <Input id="ad-ret" type="number" min={0} max={3650} value={s.retentionDays} onChange={(e) => set('retentionDays', Math.max(0, Math.min(3650, Number(e.target.value) || 0)))} style={{ maxWidth: 120 }} />
        </Field>
        <Field label="Where the data is stored" htmlFor="ad-reg" hint="For your records, e.g. “School board data centre, Ontario”. This server does not check it.">
          <Input id="ad-reg" value={s.dataRegion} onChange={(e) => set('dataRegion', e.target.value)} />
        </Field>
        <Toggle checked={s.adminCanViewChats} onChange={(v) => set('adminCanViewChats', v)} label="Administrators may open students’ chats" description="Off by default. Every opening is written to the audit log. Grading stays with teachers either way." />
        <div className="stack-1">
          <span className="small">
            Students under 13:{' '}
            {d.under13Consent ? `consent confirmed by ${d.under13Consent.confirmedBy} on ${fmtDate(d.under13Consent.at)}` : 'not confirmed. Classes marked “may include under 13” cannot accept students yet.'}
          </span>
          <div>
            <Button size="sm" onClick={() => void save({ under13Consent: !d.under13Consent }, d.under13Consent ? 'Withdrawn.' : 'Confirmed.')}>
              {d.under13Consent ? 'Withdraw confirmation' : 'I confirm the school has the consent it needs for students under 13'}
            </Button>
          </div>
        </div>
      </section>
      <div className="row">
        <Button variant="primary" onClick={() => void save()} loading={busy === 'save'}>
          Save settings
        </Button>
        {saved ? (
          <span className="small" role="status">
            {saved}
          </span>
        ) : null}
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

function Teachers({ d, onChange }: { d: SchoolAdminDto; onChange: (d: SchoolAdminDto) => void }) {
  const { run, busy, error } = useAction();
  const invite = async () => {
    const r = await run<SchoolAdminDto>('invite', 'POST', '/admin/teacher-invite');
    if (r) onChange(r);
  };
  return (
    <div className="stack-4">
      <div className="card stack-2" style={{ maxWidth: 520 }}>
        <h2 className="h2">Teacher invite</h2>
        {d.teacherInvite ? (
          <>
            <p className="class-code">{d.teacherInvite.code}</p>
            <p className="small muted">Teachers choose Teacher invite and enter this code. Expires {fmtDate(d.teacherInvite.expiresAt)}.</p>
          </>
        ) : (
          <p className="small muted">No active invite.</p>
        )}
        <div>
          <Button icon={<RefreshCw size={14} />} onClick={invite} loading={busy === 'invite'}>
            {d.teacherInvite ? 'Make a new code' : 'Make a code'}
          </Button>
        </div>
        <ErrorNote error={error} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Login</th>
              <th scope="col">Role</th>
              <th scope="col">Classes</th>
            </tr>
          </thead>
          <tbody>
            {d.teachers.map((t) => (
              <tr key={t.id}>
                <td>{t.displayName}</td>
                <td className="small">{t.login}</td>
                <td>{ROLE_LABEL[t.role]}</td>
                <td>{t.classes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Usage() {
  const q = useGet<UsageRowDto[]>('/admin/usage');
  return (
    <Loaded q={q}>
      {(rows) =>
        rows.length === 0 ? (
          <p className="small muted">No AI use this month.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col">Assessment</th>
                  <th scope="col">Requests</th>
                  <th scope="col">Tokens in / out</th>
                  <th scope="col">Estimated cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.className}</td>
                    <td>{r.assessmentTitle ?? '—'}</td>
                    <td>{r.requests}</td>
                    <td className="small">
                      {r.inputTokens.toLocaleString()} / {r.outputTokens.toLocaleString()}
                    </td>
                    <td>{money(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </Loaded>
  );
}

function Audit() {
  const [action, setAction] = useState('');
  const q = useGet<AuditEntryDto[]>(`/admin/audit${action ? `?action=${encodeURIComponent(action)}` : ''}`);
  const { run, busy, error } = useAction();
  const [purged, setPurged] = useState<string | null>(null);
  return (
    <div className="stack-3">
      <div className="row-wrap">
        <Select aria-label="Show" value={action} onChange={(e) => setAction(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Everything</option>
          <option value="submission.viewed">Chats and submissions opened</option>
          <option value="grade.overridden">Checker marks changed</option>
          <option value="evaluation.changed">AI-use levels changed</option>
          <option value="results.released">Results released</option>
          <option value="class.purged">Classes deleted by retention</option>
          <option value="school.settings">School settings changed</option>
        </Select>
        <span className="grow" />
        <Button
          onClick={async () => {
            const r = await run<{ classes: number; files: number }>('purge', 'POST', '/admin/purge');
            if (r) {
              setPurged(`${r.classes} class${r.classes === 1 ? '' : 'es'} past retention deleted.`);
              q.reload();
            }
          }}
          loading={busy === 'purge'}
        >
          Run retention check now
        </Button>
      </div>
      {purged ? (
        <p className="small" role="status">
          {purged}
        </p>
      ) : null}
      <ErrorNote error={error} />
      <Loaded q={q}>
        {(rows) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="small nowrap">{fmtDateTime(r.at)}</td>
                    <td className="small">{r.actor}</td>
                    <td className="small">
                      {r.action}
                      <div className="tiny faint">{r.target}</div>
                    </td>
                    <td className="small">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loaded>
    </div>
  );
}

export function Admin({ tab: initial }: { tab?: string }) {
  const q = useGet<SchoolAdminDto>('/admin/school');
  const { rememberTab } = useClassroom();
  const [tab, setTab] = useState<Tab>((initial as Tab) ?? 'settings');
  return (
    <div className="stack-4">
      <PageHeader title="School settings" subtitle={q.data?.school.name} />
      <Tabs
        label="School settings sections"
        value={tab}
        onChange={(v) => {
          setTab(v);
          rememberTab(v);
        }}
        tabs={[
          { value: 'settings', label: 'Settings' },
          { value: 'teachers', label: 'Teachers' },
          { value: 'usage', label: 'AI use' },
          { value: 'audit', label: 'Audit log' },
        ]}
      />
      <Loaded q={q}>
        {(d) =>
          tab === 'settings' ? (
            <SettingsForm d={d} onSaved={(n) => q.set(() => n)} />
          ) : tab === 'teachers' ? (
            <Teachers d={d} onChange={(n) => q.set(() => n)} />
          ) : tab === 'usage' ? (
            <Usage />
          ) : (
            <>
              <Audit />
              <Banner tone="info">The audit log records who opened students’ work, changed marks, released results, changed settings and deleted data.</Banner>
            </>
          )
        }
      </Loaded>
    </div>
  );
}

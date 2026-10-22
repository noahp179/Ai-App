import { DateTime } from 'luxon';
import { CheckCircle2, KeyRound, ShieldCheck, ShieldOff, XCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { ModuleId } from '../../../shared/settings';
import type { ParentalConfig } from '../../../shared/types';
import { Banner, Button, Field, Input, Modal, Toggle, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDuration } from '../../lib/format';
import { useParental } from '../../lib/parental';
import { invalidate, useQuery } from '../../lib/query';
import { LOCKABLE_MODULES } from '../../../shared/parental';
import { MODULES } from '../registry';
import { Section } from './controls';

const SESSION_CHOICES = MODULES.filter((m) => !['home', 'settings'].includes(m.id));
/** Lockable sections, optional extras (News, Games, Marketplace, Creator Studio) first. */
const LOCK_CHOICES = LOCKABLE_MODULES.map((id) => MODULES.find((m) => m.id === id)).filter((m): m is (typeof MODULES)[number] => !!m);
const moduleNames = (ids: string[]) => ids.map((id) => MODULES.find((m) => m.id === id)?.label ?? id).join(', ');

/** Asks for the parent PIN before running `onSubmit`. Errors (wrong PIN, lockout) are shown in the dialog. */
export function PinModal({ title, action, onSubmit, onClose, children }: { title: string; action: string; onSubmit: (pin: string) => Promise<void>; onClose: () => void; children?: ReactNode }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pin);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPin('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!pin} onClick={() => void submit()}>
            {action}
          </Button>
        </>
      }
    >
      <form
        className="stack-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin) void submit();
        }}
      >
        {children}
        <Field label="Parent PIN" htmlFor="pin-input" error={error}>
          <Input id="pin-input" type="password" autoFocus autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function RecoveryCodeModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <Modal
      title="Save your recovery code"
      onClose={() => saved && onClose()}
      footer={
        <Button variant="primary" disabled={!saved} onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="stack-3">
        <p>If you forget the PIN, this code lets you set a new one. It is shown only now. Write it down and keep it away from the child’s reach.</p>
        <p className="mono center" style={{ fontSize: '1.4rem', letterSpacing: '0.08em', padding: 12, background: 'var(--bg-sunken)', borderRadius: 8 }} data-testid="recovery-code">
          {code}
        </p>
        <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have saved the recovery code.
        </label>
      </div>
    </Modal>
  );
}

function ModuleChips({ value, onChange, label, choices = SESSION_CHOICES }: { value: string[]; onChange: (v: string[]) => void; label: string; choices?: typeof SESSION_CHOICES }) {
  return (
    <div className="row-wrap" style={{ gap: 4 }} role="group" aria-label={label}>
      {choices.map((m) => {
        const on = value.includes(m.id);
        return (
          <button key={m.id} type="button" className="chip" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function Scope() {
  const s = useParental();
  if (!s) return null;
  const sc = s.platform.screenCapturePrivacy;
  return (
    <div className="stack-3 small">
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="card stack-2" style={{ padding: 12 }}>
          <strong>What these controls do</strong>
          <ul className="stack-1" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Stop copying AI answers inside FlowCompanion.</li>
            <li>Tutor mode: the AI guides with hints and questions instead of writing finished homework.</li>
            <li>Supervised study sessions that open only the sections you choose, for a set time.</li>
            <li>Lock any section — such as News, Games or the Marketplace — so it stays closed until you unlock it.</li>
            <li>{sc.supported ? 'Ask the operating system to keep FlowCompanion out of screenshots and screen recordings (best effort).' : 'Screen-capture privacy is not available on this operating system.'}</li>
          </ul>
        </div>
        <div className="card stack-2" style={{ padding: 12 }}>
          <strong>What they do not do</strong>
          <ul className="stack-1" style={{ paddingLeft: 18, margin: 0 }}>
            <li>They do not monitor, record or report anything: no keystrokes, screenshots, browsing or messages.</li>
            <li>{s.platform.otherAppsAndWebsites.detail}</li>
            <li>They cannot stop a photo of the screen, retyping, or another device.</li>
            <li>Someone with administrator access to this computer, or who can edit FlowCompanion’s data files, can remove them. They support learning; they are not security software.</li>
          </ul>
        </div>
      </div>
      <p className="tiny faint">
        On this computer ({s.platform.os}): copy restriction — {s.platform.copyRestriction.scope} Screen-capture privacy — {sc.detail}
      </p>
    </div>
  );
}

function ConfigToggles({ c, onChange, captureSupported }: { c: ParentalConfig; onChange: (c: ParentalConfig) => void; captureSupported: boolean }) {
  return (
    <div className="stack-3">
      <Toggle checked={c.copyRestriction} onChange={(v) => onChange({ ...c, copyRestriction: v })} label="Block copying AI answers" description="Copy buttons, keyboard copy and text selection are disabled for AI answers in FlowCompanion." />
      <Toggle checked={c.tutorMode} onChange={(v) => onChange({ ...c, tutorMode: v })} label="Tutor mode" description="Adds instructions to every AI request so the assistant teaches rather than doing the work." />
      <Toggle
        checked={c.screenCapturePrivacy && captureSupported}
        disabled={!captureSupported}
        onChange={(v) => onChange({ ...c, screenCapturePrivacy: v })}
        label="Screen-capture privacy (best effort)"
        description={captureSupported ? 'Asks the operating system to hide FlowCompanion windows from screenshots and recordings. Some tools may still capture them.' : 'Not available on this operating system.'}
      />
      <Field label="Locked sections" hint="Locked sections stay closed, even if they are turned on in Settings → Modules. A study session can open one for its length if you include it.">
        <ModuleChips label="Locked sections" choices={LOCK_CHOICES} value={c.lockedModules} onChange={(v) => onChange({ ...c, lockedModules: v })} />
      </Field>
      <Field label="Sections available in study sessions (default)">
        <ModuleChips label="Default session sections" value={c.sessionAllowedModules} onChange={(v) => onChange({ ...c, sessionAllowedModules: v as ModuleId[] })} />
      </Field>
    </div>
  );
}

function Setup({ onRecoveryCode }: { onRecoveryCode: (code: string) => void }) {
  const p = useParental()!;
  const toast = useToast();
  const [c, setC] = useState<ParentalConfig>(p.config);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [ack, setAck] = useState(false);
  const turnOn = async () => {
    if (pin !== pin2) return toast('The two PINs do not match.', 'error');
    try {
      const r = await api.parental.setup({ pin, acknowledged: ack, config: c });
      onRecoveryCode(r.recoveryCode);
      invalidate('parental');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return (
    <div className="stack-5">
      <Section title="Parental Learning Controls" description="Optional tools for a parent or guardian helping a young person learn with FlowCompanion. They are off unless you turn them on here.">
        <Scope />
      </Section>
      <Section title="Choose controls">
        <ConfigToggles c={c} onChange={setC} captureSupported={p.platform.screenCapturePrivacy.supported} />
      </Section>
      <Section title="Set a parent PIN" description="Needed to change these settings, start or end sessions, or turn the controls off.">
        <div className="field-row">
          <Field label="PIN or passphrase" htmlFor="pc-pin" hint="At least 4 characters.">
            <Input id="pc-pin" type="password" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} />
          </Field>
          <Field label="Repeat PIN" htmlFor="pc-pin2">
            <Input id="pc-pin2" type="password" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value)} />
          </Field>
        </div>
        <label className="row small" style={{ gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 3 }} />
          <span>I am the parent or guardian setting this up openly, and I understand what these controls can and cannot do.</span>
        </label>
        <div>
          <Button variant="primary" icon={<ShieldCheck size={14} />} disabled={!ack || pin.length < 4 || !pin2} onClick={() => void turnOn()}>
            Turn on parental learning controls
          </Button>
        </div>
      </Section>
    </div>
  );
}

function StatusRow({ on, label, note }: { on: boolean; label: string; note?: string }) {
  return (
    <div className="row small" style={{ gap: 6, alignItems: 'flex-start' }}>
      {on ? <CheckCircle2 size={14} color="var(--ok)" aria-label="On" /> : <XCircle size={14} color="var(--text-faint)" aria-label="Off" />}
      <span>
        {label}
        {note ? <span className="tiny faint" style={{ display: 'block' }}>{note}</span> : null}
      </span>
    </div>
  );
}

function Manage({ onRecoveryCode }: { onRecoveryCode: (code: string) => void }) {
  const p = useParental()!;
  const toast = useToast();
  const sessions = useQuery('parental:sessions', () => api.parental.recentSessions());
  const [c, setC] = useState<ParentalConfig>(p.config);
  useEffect(() => setC(p.config), [p.config]);
  const [goal, setGoal] = useState('');
  const [minutes, setMinutes] = useState(45);
  const [mods, setMods] = useState<string[]>(p.config.sessionAllowedModules);
  const [modal, setModal] = useState<null | 'save' | 'start' | 'end' | 'disable' | 'pin' | 'recover'>(null);
  const [newPin, setNewPin] = useState('');
  const [recovery, setRecovery] = useState('');
  const dirty = JSON.stringify(c) !== JSON.stringify(p.config);
  const sc = p.platform.screenCapturePrivacy;
  const done = (msg: string) => {
    invalidate('parental');
    toast(msg, 'success');
  };

  return (
    <div className="stack-5">
      <Section title="Parental Learning Controls are on" description={`Turned on ${p.configuredAt ? DateTime.fromISO(p.configuredAt).toRelative() : ''}. A notice is shown at the top of FlowCompanion while they are on.`}>
        {p.lockedUntil ? <Banner tone="warn">Too many wrong PIN attempts. PIN actions are locked until {DateTime.fromISO(p.lockedUntil).toLocaleString(DateTime.TIME_SIMPLE)}.</Banner> : null}
        <div className="card stack-2" style={{ padding: 12 }}>
          <StatusRow on={p.config.copyRestriction} label="Copying AI answers is blocked" note={p.config.copyRestriction ? 'Inside FlowCompanion only.' : undefined} />
          <StatusRow on={p.config.tutorMode} label="Tutor mode" />
          <StatusRow on={sc.applied} label="Screen-capture privacy" note={p.config.screenCapturePrivacy ? (sc.applied ? `Requested from the operating system. ${sc.detail}` : sc.detail) : undefined} />
          <StatusRow on={p.config.lockedModules.length > 0} label={p.config.lockedModules.length ? `Locked: ${moduleNames(p.config.lockedModules)}` : 'No sections locked'} />
          <StatusRow on={!!p.session} label={p.session ? `Study session running — ${fmtDuration(Math.max(0, new Date(p.session.endsAt).getTime() - Date.now()))} left` : 'No study session running'} />
        </div>
      </Section>

      <Section title="Supervised study session" description="Only the sections you pick (plus Home and Settings) open until the time is up. The session ends by itself, even if FlowCompanion was closed.">
        {p.session ? (
          <div className="row-wrap">
            <span className="grow small">
              <strong>{p.session.goal || 'Study session'}</strong> until {DateTime.fromISO(p.session.endsAt).toLocaleString(DateTime.TIME_SIMPLE)}
            </span>
            <Button onClick={() => setModal('end')}>End session now</Button>
          </div>
        ) : (
          <div className="stack-3">
            <div className="field-row">
              <Field label="Goal (optional)" htmlFor="ss-goal">
                <Input id="ss-goal" placeholder="e.g. Fractions homework" value={goal} onChange={(e) => setGoal(e.target.value)} />
              </Field>
              <Field label="Length (minutes)" htmlFor="ss-min">
                <Input id="ss-min" type="number" min={5} max={480} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 45)} />
              </Field>
            </div>
            <Field label="Available during the session">
              <ModuleChips label="Session sections" value={mods} onChange={setMods} />
            </Field>
            <div>
              <Button variant="primary" onClick={() => setModal('start')}>
                Start session
              </Button>
            </div>
          </div>
        )}
        {sessions.data?.length ? (
          <details>
            <summary className="small muted" style={{ cursor: 'pointer' }}>
              Recent sessions
            </summary>
            <div className="stack-1 small" style={{ marginTop: 6 }}>
              {sessions.data.slice(0, 10).map((s) => (
                <div key={s.id}>
                  {DateTime.fromISO(s.startedAt).toLocaleString(DateTime.DATETIME_SHORT)} — {s.goal || 'Study session'} ({s.endedBy === 'parent' ? 'ended early' : s.endedBy === 'timer' ? 'finished' : 'running'})
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </Section>

      <Section title="Controls">
        <ConfigToggles c={c} onChange={setC} captureSupported={sc.supported} />
        <div className="row">
          <Button variant="primary" disabled={!dirty} onClick={() => setModal('save')}>
            Save changes
          </Button>
          {dirty ? (
            <Button variant="ghost" onClick={() => setC(p.config)}>
              Discard
            </Button>
          ) : null}
        </div>
      </Section>

      <Section title="PIN and turning off">
        <div className="row-wrap">
          <Button icon={<KeyRound size={14} />} onClick={() => setModal('pin')}>
            Change PIN
          </Button>
          <Button variant="ghost" onClick={() => setModal('recover')}>
            Forgot the PIN?
          </Button>
          <span className="spacer" />
          <Button variant="danger" icon={<ShieldOff size={14} />} onClick={() => setModal('disable')}>
            Turn off parental learning controls
          </Button>
        </div>
        <Scope />
      </Section>

      {modal === 'save' ? <PinModal title="Save parental settings" action="Save" onClose={() => setModal(null)} onSubmit={async (pin) => (await api.parental.updateConfig(pin, c), done('Parental settings saved'))} /> : null}
      {modal === 'start' ? (
        <PinModal title="Start a study session" action="Start" onClose={() => setModal(null)} onSubmit={async (pin) => (await api.parental.startSession(pin, { goal, minutes, allowedModules: mods }), done('Study session started'))}>
          <p className="small muted">
            {minutes} minutes. Available: {mods.map((id) => MODULES.find((m) => m.id === id)?.label ?? id).join(', ') || 'Home only'}.
          </p>
        </PinModal>
      ) : null}
      {modal === 'end' ? <PinModal title="End the study session early" action="End session" onClose={() => setModal(null)} onSubmit={async (pin) => (await api.parental.endSession(pin), done('Study session ended'))} /> : null}
      {modal === 'disable' ? (
        <PinModal title="Turn off parental learning controls" action="Turn off" onClose={() => setModal(null)} onSubmit={async (pin) => (await api.parental.disable(pin), done('Parental learning controls are off'))}>
          <p className="small muted">All restrictions are removed and any study session ends.</p>
        </PinModal>
      ) : null}
      {modal === 'pin' ? (
        <PinModal title="Change the PIN" action="Change PIN" onClose={() => (setModal(null), setNewPin(''))} onSubmit={async (pin) => (await api.parental.changePin(pin, newPin), done('PIN changed'))}>
          <Field label="New PIN" htmlFor="new-pin" hint="At least 4 characters.">
            <Input id="new-pin" type="password" autoComplete="new-password" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
          </Field>
        </PinModal>
      ) : null}
      {modal === 'recover' ? (
        <Modal
          title="Reset the PIN with your recovery code"
          onClose={() => setModal(null)}
          footer={
            <Button
              variant="primary"
              disabled={!recovery || newPin.length < 4}
              onClick={() =>
                void api.parental
                  .recover(recovery, newPin)
                  .then((r) => (setModal(null), setRecovery(''), setNewPin(''), onRecoveryCode(r.recoveryCode), invalidate('parental')))
                  .catch((e: unknown) => toast(errorMessage(e), 'error'))
              }
            >
              Reset PIN
            </Button>
          }
        >
          <div className="stack-3">
            <Field label="Recovery code" htmlFor="rc-code">
              <Input id="rc-code" autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX" value={recovery} onChange={(e) => setRecovery(e.target.value)} />
            </Field>
            <Field label="New PIN" htmlFor="rc-pin">
              <Input id="rc-pin" type="password" autoComplete="new-password" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
            </Field>
            <p className="tiny faint">You will get a new recovery code; the old one stops working.</p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function ParentalSettings() {
  const p = useParental();
  // Kept here so the one-time recovery code stays on screen when setup switches to the management view.
  const [code, setCode] = useState<string | null>(null);
  if (!p) return null;
  return (
    <>
      {p.enabled ? <Manage onRecoveryCode={setCode} /> : <Setup onRecoveryCode={setCode} />}
      {code ? <RecoveryCodeModal code={code} onClose={() => setCode(null)} /> : null}
    </>
  );
}

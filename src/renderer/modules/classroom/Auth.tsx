import { School } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { ServerInfo, SessionDto, UserDto } from '../../../shared/classroom/protocol';
import { ClassroomError } from '../../../shared/classroom/transport';
import { Banner, Button, Field, Input, Tabs } from '../../components/ui';
import { ErrorNote } from './common';
import { useTransport } from './context';

/** Desktop only: which classroom server to use. */
export function ConnectScreen({ onConnected, initial = '' }: { onConnected: (info: ServerInfo) => void; initial?: string }) {
  const t = useTransport();
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onConnected(await t.connect!(url));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="classroom-auth card stack-4">
      <div className="row">
        <School size={22} color="var(--accent)" aria-hidden />
        <h1 className="grow">Classroom</h1>
      </div>
      <p className="muted">
        Classroom connects to your school’s FlowCompanion classroom server, where teachers set quizzes, tests and assignments. Your school gives you its address. Nothing in the rest of FlowCompanion is shared with it.
      </p>
      <form className="stack-3" onSubmit={submit}>
        <Field label="Classroom server address" htmlFor="cls-url" hint="For example https://classroom.myschool.ca">
          <Input id="cls-url" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="url" inputMode="url" required />
        </Field>
        <ErrorNote error={error} />
        <div>
          <Button type="submit" variant="primary" loading={busy}>
            Connect
          </Button>
        </div>
      </form>
    </div>
  );
}

type Mode = 'signin' | 'join' | 'teacher' | 'school';

export function AuthScreen({ info, onSignedIn, onChangeServer }: { info: ServerInfo | null; onSignedIn: (u: UserDto) => void; onChangeServer?: () => void }) {
  const t = useTransport();
  const [mode, setMode] = useState<Mode>(info && info.schools === 0 ? 'school' : 'signin');
  const [f, setF] = useState({ login: '', password: '', displayName: '', code: '', inviteCode: '', schoolName: '', setupCode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinInfo, setJoinInfo] = useState<{ className: string; schoolName: string } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  // Check a class code as it is typed, so students know they have the right class.
  useEffect(() => {
    setJoinInfo(null);
    const code = f.code.trim();
    if (mode !== 'join' || code.length < 4) return;
    const timer = setTimeout(() => {
      t.request<{ className: string; schoolName: string }>('GET', `/join/${encodeURIComponent(code)}`).then(setJoinInfo, () => setJoinInfo(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [f.code, mode, t]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const login = f.login.trim();
      let user: UserDto;
      if (mode === 'signin') user = (await t.request<SessionDto>('POST', '/sessions', { login, password: f.password })).user;
      else if (mode === 'teacher') user = (await t.request<SessionDto>('POST', '/teachers', { inviteCode: f.inviteCode.trim(), displayName: f.displayName, login, password: f.password })).user;
      else if (mode === 'school')
        user = (await t.request<SessionDto>('POST', '/schools', { schoolName: f.schoolName, displayName: f.displayName, login, password: f.password, ...(f.setupCode ? { setupCode: f.setupCode } : {}) })).user;
      else {
        const r = await t.request<{ session?: SessionDto }>('POST', '/join', { code: f.code.trim(), displayName: f.displayName || undefined, login, password: f.password });
        user = r.session ? r.session.user : await t.request<UserDto>('GET', '/me');
      }
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof ClassroomError || err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const tabs: { value: Mode; label: string }[] = [
    { value: 'signin', label: 'Sign in' },
    { value: 'join', label: 'Join a class' },
    { value: 'teacher', label: 'Teacher invite' },
  ];
  if (!info || info.openSetup || info.schools === 0) tabs.push({ value: 'school', label: 'Set up a school' });

  return (
    <div className="classroom-auth card stack-4">
      <div className="row">
        <School size={22} color="var(--accent)" aria-hidden />
        <div className="grow">
          <h1>Classroom</h1>
          {info ? <div className="small muted">{info.name}</div> : null}
        </div>
        {onChangeServer ? (
          <Button size="sm" variant="ghost" onClick={onChangeServer}>
            Change server
          </Button>
        ) : null}
      </div>
      <Tabs label="How do you want to start?" value={mode} tabs={tabs} onChange={(m) => (setMode(m), setError(null))} />
      <form className="stack-3" onSubmit={submit} aria-label={tabs.find((x) => x.value === mode)?.label}>
        {mode === 'join' ? (
          <>
            <p className="small muted">Your teacher gives you a class code. If you already have an account, use the same email or username and password; otherwise this creates one.</p>
            <Field label="Class code" htmlFor="cls-code" hint={joinInfo ? `${joinInfo.className} · ${joinInfo.schoolName}` : undefined}>
              <Input id="cls-code" value={f.code} onChange={set('code')} autoComplete="off" autoCapitalize="characters" required />
            </Field>
            <Field label="Your name" htmlFor="cls-name" hint="As your teacher knows you. Needed only for a new account.">
              <Input id="cls-name" value={f.displayName} onChange={set('displayName')} autoComplete="name" />
            </Field>
          </>
        ) : null}
        {mode === 'teacher' ? (
          <>
            <p className="small muted">Your school’s administrator gives teachers an invite code.</p>
            <Field label="Invite code" htmlFor="cls-invite">
              <Input id="cls-invite" value={f.inviteCode} onChange={set('inviteCode')} autoComplete="off" required />
            </Field>
            <Field label="Your name" htmlFor="cls-name" hint="Students see this name.">
              <Input id="cls-name" value={f.displayName} onChange={set('displayName')} autoComplete="name" required />
            </Field>
          </>
        ) : null}
        {mode === 'school' ? (
          <>
            <p className="small muted">This creates the school and makes you its administrator. You can then invite teachers.</p>
            <Field label="School name" htmlFor="cls-school">
              <Input id="cls-school" value={f.schoolName} onChange={set('schoolName')} required />
            </Field>
            <Field label="Your name" htmlFor="cls-name">
              <Input id="cls-name" value={f.displayName} onChange={set('displayName')} autoComplete="name" required />
            </Field>
            {info && !info.openSetup && info.schools > 0 ? null : (
              <Field label="Setup code" htmlFor="cls-setup" hint="Only if the person who runs the server gave you one.">
                <Input id="cls-setup" value={f.setupCode} onChange={set('setupCode')} autoComplete="off" />
              </Field>
            )}
          </>
        ) : null}
        <Field label="Email or username" htmlFor="cls-login">
          <Input id="cls-login" value={f.login} onChange={set('login')} autoComplete="username" autoCapitalize="off" spellCheck={false} required />
        </Field>
        <Field label="Password" htmlFor="cls-pass" hint={mode === 'signin' ? undefined : 'At least 8 characters.'}>
          <Input id="cls-pass" type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
        </Field>
        <ErrorNote error={error} />
        <div>
          <Button type="submit" variant="primary" loading={busy}>
            {mode === 'signin' ? 'Sign in' : mode === 'join' ? 'Join class' : mode === 'teacher' ? 'Create teacher account' : 'Create school'}
          </Button>
        </div>
      </form>
      {info && !info.capabilities.ai ? <Banner tone="info">The AI assistant is not set up on this server yet. An administrator adds the school’s AI key in School settings.</Banner> : null}
    </div>
  );
}

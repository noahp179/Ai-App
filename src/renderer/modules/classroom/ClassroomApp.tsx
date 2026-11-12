import { useCallback, useEffect, useState } from 'react';
import type { ClassDto, ServerInfo, UserDto } from '../../../shared/classroom/protocol';
import { ClassroomError, type ClassroomTransport } from '../../../shared/classroom/transport';
import { Button, Loading } from '../../components/ui';
import { Admin } from './Admin';
import { AssessmentPage } from './AssessmentEditor';
import { AuthScreen, ConnectScreen } from './Auth';
import { ErrorNote, Loaded } from './common';
import { ClassroomProvider, TransportContext, useClassroom, useGet } from './context';
import { Account, Home } from './Home';
import { Review } from './Review';
import { Intro, Result, StudentClass } from './Student';
import { TeacherClass } from './TeacherClass';
import { Workspace } from './Workspace';

function ClassPage({ id, tab }: { id: string; tab?: string }) {
  const q = useGet<ClassDto>(`/classes/${id}`);
  return <Loaded q={q}>{(cls) => (cls.myRole === 'student' ? <StudentClass cls={cls} /> : <TeacherClass cls={cls} reload={q.reload} tab={tab} />)}</Loaded>;
}

function Screens() {
  const { view } = useClassroom();
  switch (view.v) {
    case 'home':
      return <Home />;
    case 'class':
      return <ClassPage key={view.id} id={view.id} tab={view.tab} />;
    case 'assessment':
      return <AssessmentPage key={view.id} id={view.id} tab={view.tab} />;
    case 'review':
      return <Review key={view.attemptId} attemptId={view.attemptId} />;
    case 'intro':
      return <Intro id={view.id} />;
    case 'work':
      return <Workspace key={view.attemptId} attemptId={view.attemptId} />;
    case 'result':
      return <Result attemptId={view.attemptId} />;
    case 'admin':
      return <Admin tab={view.tab} />;
    case 'account':
      return <Account />;
  }
}

type Phase = { p: 'loading' } | { p: 'connect'; url: string } | { p: 'auth'; info: ServerInfo | null } | { p: 'in'; me: UserDto } | { p: 'error'; message: string };

/** The classroom section. Runs inside the desktop app and as the browser build, with a different transport. */
export function ClassroomApp({ transport }: { transport: ClassroomTransport }) {
  const [phase, setPhase] = useState<Phase>({ p: 'loading' });
  const start = useCallback(async () => {
    setPhase({ p: 'loading' });
    try {
      const st = await transport.status();
      if (transport.kind === 'desktop' && !st.url) return setPhase({ p: 'connect', url: '' });
      const info = await transport.request<ServerInfo>('GET', '/info').catch(() => null);
      if (!info) return setPhase(transport.kind === 'desktop' ? { p: 'connect', url: st.url ?? '' } : { p: 'error', message: 'The classroom server is not answering. Try again in a moment.' });
      try {
        setPhase({ p: 'in', me: await transport.request<UserDto>('GET', '/me') });
      } catch (e) {
        if (e instanceof ClassroomError && e.status === 401) setPhase({ p: 'auth', info });
        else throw e;
      }
    } catch (e) {
      setPhase({ p: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [transport]);
  useEffect(() => {
    void start();
  }, [start]);

  let body;
  if (phase.p === 'loading') body = <Loading label="Connecting to the classroom…" />;
  else if (phase.p === 'connect') body = <ConnectScreen initial={phase.url} onConnected={(info) => setPhase({ p: 'auth', info })} />;
  else if (phase.p === 'auth')
    body = (
      <AuthScreen
        info={phase.info}
        onSignedIn={(me) => setPhase({ p: 'in', me })}
        onChangeServer={
          transport.kind === 'desktop'
            ? () => {
                void transport.disconnect?.();
                setPhase({ p: 'connect', url: '' });
              }
            : undefined
        }
      />
    );
  else if (phase.p === 'error')
    body = (
      <div className="stack-3" style={{ maxWidth: 560 }}>
        <ErrorNote error={phase.message} />
        <div className="row">
          <Button onClick={() => void start()}>Try again</Button>
          {transport.kind === 'desktop' ? (
            <Button variant="ghost" onClick={() => (void transport.disconnect?.(), setPhase({ p: 'connect', url: '' }))}>
              Use a different server
            </Button>
          ) : null}
        </div>
      </div>
    );
  else
    body = (
      <ClassroomProvider t={transport} me={phase.me} onSignedOut={() => void start()}>
        <Screens />
      </ClassroomProvider>
    );
  return (
    <TransportContext.Provider value={transport}>
      <div className="classroom">{body}</div>
    </TransportContext.Provider>
  );
}

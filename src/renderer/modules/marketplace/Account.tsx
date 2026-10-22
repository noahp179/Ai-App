import { CheckCircle2, LogOut, Server, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Banner, Button, Field, Input, Segmented, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { useSettings } from '../../lib/settings';

/** Marketplace server address, connection status and sign-in. Used in Settings and the Marketplace. */
export function MarketplaceAccount() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const status = useQuery(`marketplace:status:${settings.marketplace.serverUrl}`, () => api.marketplace.status());
  const [url, setUrl] = useState(settings.marketplace.serverUrl);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const s = status.data;

  const saveUrl = async () => {
    try {
      await update({ marketplace: { serverUrl: url.trim() } });
      invalidate('marketplace');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const auth = async () => {
    setBusy(true);
    try {
      if (mode === 'login') await api.marketplace.login({ email, password });
      else await api.marketplace.register({ email, password, displayName: name });
      setPassword('');
      invalidate('marketplace');
      invalidate('creator');
      toast('Signed in to the marketplace', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-4">
      <Field label="Marketplace server" hint="Optional. Without a server you can still use the free starter prompts, your own drafts and listing files. Use https:// (http only for localhost)." htmlFor="mk-url">
        <div className="row">
          <Input id="mk-url" placeholder="https://market.example.org" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={() => void saveUrl()} disabled={url.trim() === settings.marketplace.serverUrl}>
            Save
          </Button>
          {settings.marketplace.serverUrl ? (
            <Button variant="ghost" onClick={() => (setUrl(''), void update({ marketplace: { serverUrl: '' } }).then(() => invalidate('marketplace')))}>
              Disconnect
            </Button>
          ) : null}
        </div>
      </Field>
      {settings.marketplace.serverUrl && s ? (
        s.error ? (
          <Banner tone="warn">
            <span className="row" style={{ gap: 6 }}>
              <TriangleAlert size={14} /> {s.error}
            </span>
          </Banner>
        ) : s.info ? (
          <div className="small stack-2">
            <div className="row" style={{ gap: 6 }}>
              <Server size={14} color="var(--ok)" /> Connected to <strong>{s.info.name}</strong>
            </div>
            <div className="muted">
              {s.info.paymentsEnabled ? 'Payments are enabled on this server.' : 'Payments are not set up on this server: paid listings can be tried for free, but not bought.'} Trials last {s.info.trialDays} days and are enforced by the server.
              {s.info.demoContent ? ' This server includes sample listings marked “Demo”.' : ''}
            </div>
          </div>
        ) : null
      ) : null}
      {settings.marketplace.serverUrl && s?.info ? (
        s.account ? (
          <div className="card stack-2" style={{ padding: 12 }}>
            <div className="row">
              <CheckCircle2 size={15} color="var(--ok)" />
              <span className="grow">
                Signed in as <strong>{s.account.displayName}</strong> ({s.account.email}){s.account.role === 'admin' ? ' · moderator' : ''}
              </span>
              <Button size="sm" variant="ghost" icon={<LogOut size={13} />} onClick={() => void api.marketplace.logout().then(() => (invalidate('marketplace'), invalidate('creator')))}>
                Sign out
              </Button>
            </div>
            {s.tokenStorage === 'session' ? <p className="tiny faint">This computer has no secure credential storage, so you will need to sign in again after restarting FlowCompanion.</p> : <p className="tiny faint">Your sign-in is stored encrypted by the operating system. Your password is never stored.</p>}
          </div>
        ) : (
          <form
            className="card stack-3"
            style={{ padding: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              void auth();
            }}
          >
            <Segmented
              label="Account"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'login', label: 'Sign in' },
                { value: 'register', label: 'Create account' },
              ]}
            />
            {mode === 'register' ? (
              <Field label="Display name" htmlFor="mk-name" hint="Shown on your listings and reviews.">
                <Input id="mk-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
              </Field>
            ) : null}
            <Field label="Email" htmlFor="mk-email">
              <Input id="mk-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Password" htmlFor="mk-pw" hint={mode === 'register' ? 'At least 10 characters.' : undefined}>
              <Input id="mk-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            </Field>
            <div>
              <Button type="submit" variant="primary" loading={busy} disabled={!email || !password || (mode === 'register' && !name)}>
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </div>
            <p className="tiny faint">Your email and password go only to {new URL(settings.marketplace.serverUrl).host}, not to FlowCompanion’s developers.</p>
          </form>
        )
      ) : null}
    </div>
  );
}

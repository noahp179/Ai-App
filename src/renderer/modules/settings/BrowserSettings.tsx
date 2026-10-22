import { DateTime } from 'luxon';
import { FolderOpen, Link2, Unlink } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { useSettings } from '../../lib/settings';
import { Banner, Button, useToast } from '../../components/ui';
import { NumberSetting, Section, ToggleSetting } from './controls';

export function BrowserSettings() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const st = useQuery(`browser:status:${settings.browser.bridgeEnabled}:${settings.browser.bridgePort}`, () => api.browser.status());
  const folder = useQuery('browser:folder', () => api.browser.extensionFolder());
  const s = st.data;
  return (
    <div className="stack-5">
      <Section
        title="Browser extension (optional)"
        description="The FlowCompanion extension lets you save the page you are reading, or selected text, straight into FlowCompanion, and open a prompt about a selection in the AI workspace. FlowCompanion works fully without it."
      >
        <ToggleSetting
          label="Browser bridge"
          description="Lets the paired extension reach FlowCompanion on this computer only (127.0.0.1). Web pages cannot use it. Off by default."
          value={settings.browser.bridgeEnabled}
          onSave={(v) => update({ browser: { bridgeEnabled: v } })}
        />
        <NumberSetting label="Port" hint="Change only if another program uses this port. Enter the same port in the extension." value={settings.browser.bridgePort} min={1024} max={65535} onSave={(v) => update({ browser: { bridgePort: v } })} />
        {settings.browser.bridgeEnabled && s ? (
          s.error ? (
            <Banner tone="warn">{s.error}</Banner>
          ) : s.listening ? (
            <p className="small" role="status">
              Listening on 127.0.0.1:{s.port}
              {s.lastRequestAt ? ` · last request ${DateTime.fromISO(s.lastRequestAt).toRelative()}` : ''}
            </p>
          ) : (
            <p className="small muted">Starting…</p>
          )
        ) : null}
      </Section>
      {settings.browser.bridgeEnabled && s?.listening ? (
        <Section title="Paired browsers">
          {s.clients.length === 0 ? <p className="small muted">No browser is paired yet.</p> : null}
          {s.clients.map((c) => (
            <div key={c.id} className="row small">
              <Link2 size={14} />
              <span className="grow">
                {c.name} · paired {DateTime.fromISO(c.pairedAt).toRelative()}
                {c.lastSeenAt ? ` · last used ${DateTime.fromISO(c.lastSeenAt).toRelative()}` : ''}
              </span>
              <Button size="sm" variant="ghost" icon={<Unlink size={13} />} onClick={() => void api.browser.unpair(c.id).then(() => invalidate('browser'))}>
                Unpair
              </Button>
            </div>
          ))}
          {s.pairingCode ? (
            <div className="card stack-2" style={{ padding: 12 }}>
              <p className="small">Enter this code in the extension popup:</p>
              <p className="mono" style={{ fontSize: '1.6rem', letterSpacing: '0.1em' }} data-testid="pairing-code">
                {s.pairingCode}
              </p>
              <p className="tiny faint">Valid until {s.pairingExpiresAt ? DateTime.fromISO(s.pairingExpiresAt).toLocaleString(DateTime.TIME_WITH_SECONDS) : ''}. It works once.</p>
              <div>
                <Button size="sm" variant="ghost" onClick={() => void api.browser.cancelPairing().then(() => invalidate('browser'))}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                variant="primary"
                onClick={() =>
                  void api.browser
                    .startPairing()
                    .then(() => invalidate('browser'))
                    .catch((e: unknown) => toast(errorMessage(e), 'error'))
                }
              >
                Pair a browser
              </Button>
            </div>
          )}
        </Section>
      ) : null}
      <Section title="Install the extension">
        <ol className="stack-2 small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Open the extension folder below.</li>
          <li>
            In Chrome, Edge or Brave open <span className="mono">chrome://extensions</span>, turn on Developer mode, choose <b>Load unpacked</b> and select that folder.
          </li>
          <li>Turn on the browser bridge above, choose Pair a browser, and type the code into the extension’s popup.</li>
        </ol>
        <div className="row">
          <Button size="sm" icon={<FolderOpen size={13} />} onClick={() => void api.browser.openExtensionFolder()}>
            Open extension folder
          </Button>
          <span className="tiny faint mono ellipsis">{folder.data}</span>
        </div>
        <p className="tiny faint">The extension is not in a browser store. It only talks to FlowCompanion on this computer and reads selected text only when you click one of its actions. It does not enforce parental controls on websites.</p>
      </Section>
    </div>
  );
}

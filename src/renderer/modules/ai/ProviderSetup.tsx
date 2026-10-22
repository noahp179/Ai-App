import { CheckCircle2, Cpu, KeyRound, Plug, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { ProviderCatalogEntry, ProviderView } from '../../../shared/api';
import type { ProviderKind } from '../../../shared/types';
import { Badge, Banner, Button, Field, Input, Loading, Select, Toggle, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { useSettings } from '../../lib/settings';

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Adds a provider: pick a type, enter address/key, test, done. */
export function AddProvider({ catalog, onDone }: { catalog: ProviderCatalogEntry[]; onDone?: (p: ProviderView) => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<ProviderKind | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entry = catalog.find((c) => c.kind === kind) ?? null;

  if (!entry) {
    return (
      <div className="grid grid-2">
        {catalog.map((c) => (
          <button
            key={c.kind}
            type="button"
            className="card interactive"
            style={{ textAlign: 'left' }}
            onClick={() => {
              setKind(c.kind);
              setBaseUrl(c.defaultBaseUrl);
              setError(null);
            }}
          >
            <div className="row" style={{ marginBottom: 6 }}>
              {c.capabilities.local ? <Cpu size={16} /> : <Plug size={16} />}
              <strong>{c.label}</strong>
              <span className="spacer" />
              {c.capabilities.local ? <Badge tone="ok">Runs locally</Badge> : <Badge>Cloud</Badge>}
            </div>
            <p className="small muted">{c.setupHelp}</p>
          </button>
        ))}
      </div>
    );
  }

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await api.ai.createProvider({ kind: entry.kind, baseUrl, apiKey: apiKey || null });
      const status = await api.ai.testProvider(p.id);
      invalidate('providers');
      if (status.ok) toast(`${p.name} connected`, 'success');
      else toast(`Saved, but the connection test failed: ${status.message}`, 'error');
      onDone?.(p);
      setKind(null);
      setApiKey('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack-4">
      <div className="row">
        <h3 className="grow">Connect {entry.label}</h3>
        <Button variant="ghost" size="sm" onClick={() => setKind(null)}>
          Back
        </Button>
      </div>
      <p className="small muted">{entry.setupHelp}</p>
      <Field label="Address" hint="Change this only for a proxy, a self-hosted gateway or a local server on another port." htmlFor="pv-url">
        <Input id="pv-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} />
      </Field>
      <Field
        label={entry.capabilities.requiresApiKey ? 'API key' : 'API key (optional)'}
        hint="Stored with your operating system’s secure storage when available. FlowCompanion never asks for your account password."
        htmlFor="pv-key"
      >
        <Input id="pv-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" spellCheck={false} />
      </Field>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <div className="row">
        <Button variant="primary" loading={busy} disabled={entry.capabilities.requiresApiKey && !apiKey.trim()} onClick={() => void connect()}>
          Connect and test
        </Button>
      </div>
    </div>
  );
}

function ProviderCard({ p, isDefault }: { p: ProviderView; isDefault: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { update } = useSettings();
  const [testing, setTesting] = useState(false);
  const [key, setKey] = useState('');
  const models = useQuery(`providers:models:${p.id}:${p.lastStatus?.checkedAt ?? ''}`, () => api.ai.models(p.id));
  const [customModel, setCustomModel] = useState('');

  const test = async () => {
    setTesting(true);
    try {
      const s = await api.ai.testProvider(p.id);
      toast(s.ok ? s.message : `Connection failed: ${s.message}`, s.ok ? 'success' : 'error');
      invalidate('providers');
    } finally {
      setTesting(false);
    }
  };
  const patch = async (patchData: Parameters<typeof api.ai.updateProvider>[1]) => {
    try {
      await api.ai.updateProvider(p.id, patchData);
      invalidate('providers');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const opts = p.options as { effort?: string | null; refusalFallback?: boolean; preserveThinking?: boolean };
  const modelList = models.data ?? [];
  const inList = !p.defaultModel || modelList.some((m) => m.id === p.defaultModel);

  return (
    <div className="card stack-3">
      <div className="row">
        {p.lastStatus ? p.lastStatus.ok ? <CheckCircle2 size={16} color="var(--ok)" /> : <XCircle size={16} color="var(--danger)" /> : <Plug size={16} />}
        <strong>{p.name}</strong>
        {isDefault ? <Badge tone="accent">Default</Badge> : null}
        {!p.enabled ? <Badge>Off</Badge> : null}
        <span className="spacer" />
        <span className="small faint">{hostOf(p.baseUrl)}</span>
      </div>
      {p.lastStatus ? <div className={`small ${p.lastStatus.ok ? 'muted' : 'danger-text'}`}>{p.lastStatus.message}</div> : <div className="small muted">Not tested yet.</div>}
      <div className="field-row">
        <Field label="Default model" htmlFor={`m-${p.id}`}>
          {modelList.length ? (
            <Select
              id={`m-${p.id}`}
              value={inList ? (p.defaultModel ?? '') : '__custom'}
              onChange={(e) => e.target.value !== '__custom' && void patch({ defaultModel: e.target.value || null })}
            >
              <option value="">Choose…</option>
              {modelList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              {!inList ? <option value="__custom">{p.defaultModel}</option> : null}
            </Select>
          ) : (
            <div className="row">
              <Input
                id={`m-${p.id}`}
                placeholder={p.defaultModel ?? 'Model name'}
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                onBlur={() => customModel.trim() && void patch({ defaultModel: customModel.trim() })}
              />
            </div>
          )}
        </Field>
        <Field label={p.hasApiKey ? 'Replace API key' : 'API key'} hint={p.keyStorage === 'secure' ? 'Saved in secure storage.' : p.keyStorage === 'session' ? 'Held in memory for this session only.' : 'No key saved.'} htmlFor={`k-${p.id}`}>
          <div className="row">
            <Input id={`k-${p.id}`} type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" placeholder={p.hasApiKey ? '••••••••' : ''} />
            <Button
              size="sm"
              disabled={!key.trim()}
              onClick={async () => {
                try {
                  const where = await api.ai.setApiKey(p.id, key);
                  setKey('');
                  toast(where === 'secure' ? 'Key saved to secure storage' : 'Key kept in memory for this session', 'success');
                  invalidate('providers');
                } catch (err) {
                  toast(errorMessage(err), 'error');
                }
              }}
            >
              <KeyRound size={14} /> Save
            </Button>
          </div>
        </Field>
      </div>
      {p.kind === 'anthropic' ? (
        <div className="stack-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <Field label="Effort" hint="How much Claude thinks before answering. Lower is faster and cheaper. Model default is used when unset (medium on Claude Opus 5.5)." htmlFor={`e-${p.id}`}>
            <Select id={`e-${p.id}`} value={opts.effort ?? ''} onChange={(e) => void patch({ options: { effort: e.target.value || null } })}>
              <option value="">Model default</option>
              {['low', 'medium', 'high', 'xhigh', 'max'].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </Field>
          <Toggle
            checked={opts.refusalFallback !== false}
            onChange={(v) => void patch({ options: { refusalFallback: v } })}
            label="Refusal fallback"
            description="If Claude’s safety system declines a request, Anthropic may answer it with another Claude model instead. FlowCompanion shows which model answered. Claude API only."
          />
          <Toggle
            checked={opts.preserveThinking !== false}
            onChange={(v) => void patch({ options: { preserveThinking: v } })}
            label="Carry reasoning between turns"
            description="Sends Claude’s earlier response blocks back unchanged so it keeps its reasoning and the prompt cache. Stored locally with the conversation."
          />
        </div>
      ) : null}
      <div className="row-wrap">
        <Button size="sm" loading={testing} onClick={() => void test()} icon={<RefreshCw size={14} />}>
          Test and load models
        </Button>
        {!isDefault ? (
          <Button size="sm" onClick={() => void update({ ai: { defaultProviderId: p.id } })}>
            Make default
          </Button>
        ) : null}
        <Button size="sm" onClick={() => void patch({ enabled: !p.enabled })}>
          {p.enabled ? 'Turn off' : 'Turn on'}
        </Button>
        <span className="spacer" />
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 size={14} />}
          onClick={async () => {
            if (
              await confirm({
                title: `Disconnect ${p.name}?`,
                message: 'The provider and its saved API key are removed from this computer. Your conversations stay.',
                confirmLabel: 'Disconnect',
                danger: true,
              })
            ) {
              await api.ai.deleteProvider(p.id);
              invalidate('providers');
            }
          }}
        >
          Disconnect
        </Button>
      </div>
    </div>
  );
}

/** Lists connected providers and lets the user add more. Used in Settings and the AI setup screen. */
export function ProviderManager() {
  const { settings } = useSettings();
  const providers = useQuery('providers:list', () => api.ai.providers());
  const catalog = useQuery('providers:catalog', () => api.ai.catalog());
  const status = useQuery('providers:status', () => api.ai.status());
  const [adding, setAdding] = useState(false);
  if (!providers.data || !catalog.data) return <Loading />;
  return (
    <div className="stack-4">
      {status.data && !status.data.secureStorage ? (
        <Banner tone="warn" title="No system keychain available">
          API keys can’t be encrypted by the operating system here, so they are kept in memory for this session only and must be re-entered after a restart.
        </Banner>
      ) : null}
      {providers.data.map((p) => (
        <ProviderCard key={p.id} p={p} isDefault={settings.ai.defaultProviderId === p.id} />
      ))}
      {providers.data.length === 0 || adding ? (
        <AddProvider catalog={catalog.data} onDone={() => setAdding(false)} />
      ) : (
        <Button onClick={() => setAdding(true)} icon={<Plug size={14} />}>
          Connect another provider
        </Button>
      )}
    </div>
  );
}

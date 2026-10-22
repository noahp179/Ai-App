import { ArrowLeft, BarChart3, CheckCircle2, Circle, Download, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ListingDraftInput, ListingStatus } from '../../../shared/types';
import { PROMPT_CATEGORIES, PROVIDER_LABELS } from '../../../shared/prompts';
import { Badge, Banner, Button, EmptyState, Field, Input, Loading, Modal, Segmented, Select, Textarea, Toggle, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STATUS: Record<ListingStatus, { label: string; tone: 'accent' | 'ok' | 'warn' | 'danger' | 'outline' }> = {
  draft: { label: 'Draft', tone: 'outline' },
  pending_review: { label: 'Waiting for review', tone: 'accent' },
  published: { label: 'Published', tone: 'ok' },
  rejected: { label: 'Changes requested', tone: 'warn' },
  removed: { label: 'Removed by moderator', tone: 'danger' },
};

function StatusBadge({ remote }: { remote: ListingStatus | null }) {
  if (!remote) return <Badge tone="outline">Only on this computer</Badge>;
  const s = STATUS[remote];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

function Profile() {
  const toast = useToast();
  const p = useQuery('creator:profile', () => api.creator.profile());
  const [d, setD] = useState({ displayName: '', bio: '', website: '' });
  useEffect(() => {
    if (p.data) setD({ displayName: p.data.displayName, bio: p.data.bio, website: p.data.website });
  }, [p.data]);
  if (!p.data) return null;
  const dirty = d.displayName !== p.data.displayName || d.bio !== p.data.bio || d.website !== p.data.website;
  return (
    <div className="card stack-3">
      <h3>Creator profile</h3>
      <Field label="Display name" htmlFor="cr-name">
        <Input id="cr-name" value={d.displayName} onChange={(e) => setD({ ...d, displayName: e.target.value })} />
      </Field>
      <Field label="About you" htmlFor="cr-bio">
        <Textarea id="cr-bio" rows={3} value={d.bio} onChange={(e) => setD({ ...d, bio: e.target.value })} />
      </Field>
      <Field label="Website (optional)" htmlFor="cr-web">
        <Input id="cr-web" placeholder="https://" value={d.website} onChange={(e) => setD({ ...d, website: e.target.value })} />
      </Field>
      <div>
        <Button
          disabled={!dirty}
          onClick={() =>
            void api.creator
              .saveProfile(d)
              .then(() => (invalidate('creator'), toast('Profile saved', 'success')))
              .catch((e: unknown) => toast(errorMessage(e), 'error'))
          }
        >
          Save profile
        </Button>
      </div>
      <p className="tiny faint">Shown on listings you publish to a marketplace server or share as files.</p>
    </div>
  );
}

function FromPromptModal({ onClose }: { onClose: () => void }) {
  const prompts = useQuery('prompts:list:creator', () => api.prompts.list({ sort: 'title' }));
  return (
    <Modal title="Start from a prompt in your library" onClose={onClose}>
      {prompts.data?.length === 0 ? <p className="small muted">Your Prompt Library is empty.</p> : null}
      <div className="list" style={{ maxHeight: 360, overflow: 'auto' }}>
        {prompts.data
          ?.filter((p) => p.origin === 'user')
          .map((p) => (
            <button key={p.id} type="button" className="list-item" onClick={() => void api.creator.fromPrompt(p.id).then((l) => (invalidate('creator'), onClose(), navigate(`/creator/${l.id}`)))}>
              <span className="grow ellipsis">{p.title}</span>
              <span className="tiny faint">{cap(p.category)}</span>
            </button>
          ))}
      </div>
      <p className="tiny faint" style={{ marginTop: 8 }}>
        Prompts you saved from the marketplace are not listed: only share prompts you wrote.
      </p>
    </Modal>
  );
}

function Home() {
  const toast = useToast();
  const listings = useQuery('creator:listings', () => api.creator.listings());
  const status = useQuery('marketplace:status', () => api.marketplace.status());
  const [pick, setPick] = useState(false);
  const signedIn = !!status.data?.account;
  return (
    <div className="stack-5">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <h1>Creator Studio</h1>
          <p className="muted" style={{ marginTop: 4, maxWidth: 720 }}>
            Turn your prompts into listings. Share free listings as files, or publish to a marketplace server where moderators review them before they appear.
          </p>
        </div>
        {signedIn ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw size={13} />}
            onClick={() =>
              void api.creator
                .sync()
                .then(() => invalidate('creator'))
                .catch((e: unknown) => toast(errorMessage(e), 'error'))
            }
          >
            Refresh review status
          </Button>
        ) : null}
        <Button size="sm" onClick={() => setPick(true)}>
          From a prompt
        </Button>
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => void api.creator.createDraft({}).then((l) => (invalidate('creator'), navigate(`/creator/${l.id}`)))}>
          New listing
        </Button>
      </div>
      {!status.data?.serverUrl ? (
        <Banner tone="info">
          No marketplace server is set up, so you can draft listings and export free ones as files.{' '}
          <button type="button" className="link-button" style={{ color: 'var(--accent)' }} onClick={() => navigate('/settings/marketplace')}>
            Set up a server
          </button>
        </Banner>
      ) : !signedIn ? (
        <Banner tone="info">Sign in to your marketplace server (Settings → Marketplace) to publish listings.</Banner>
      ) : null}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(320px, 1fr) minmax(260px, 360px)', alignItems: 'start' }}>
        <div className="stack-3">
          {listings.data?.length === 0 ? <EmptyState title="No listings yet">Create one from scratch or from a prompt in your library.</EmptyState> : null}
          {listings.data?.map((l) => (
            <button key={l.id} type="button" className="card interactive row-wrap" style={{ textAlign: 'left', padding: 14 }} onClick={() => navigate(`/creator/${l.id}`)}>
              <div className="grow" style={{ minWidth: 0 }}>
                <strong className="ellipsis">{l.title}</strong>
                <div className="tiny faint">
                  v{l.version} · {l.pricing.type === 'free' ? 'Free' : 'Paid'} · edited {fmtRelative(l.updatedAt)}
                </div>
              </div>
              <StatusBadge remote={l.remoteStatus} />
            </button>
          ))}
        </div>
        <Profile />
      </div>
      {pick ? <FromPromptModal onClose={() => setPick(false)} /> : null}
    </div>
  );
}

function Analytics({ id }: { id: string }) {
  const a = useQuery(`creator:analytics:${id}`, () => api.creator.analytics(id));
  if (!a.data) return null;
  const s = a.data.server;
  return (
    <div className="card stack-3">
      <div className="row">
        <BarChart3 size={15} color="var(--accent)" />
        <h3>Analytics</h3>
      </div>
      {s ? (
        <dl className="facts small">
          <dt>Page views</dt>
          <dd>{s.views}</dd>
          <dt>Trials started</dt>
          <dd>{s.trialStarts}</dd>
          <dt>Free acquisitions</dt>
          <dd>{s.acquisitions}</dd>
          <dt>Reviews</dt>
          <dd>
            {s.reviews}
            {s.averageRating !== null ? ` (average ${s.averageRating})` : ''}
          </dd>
        </dl>
      ) : null}
      <p className="tiny faint">{a.data.note}</p>
    </div>
  );
}

function Editor({ id }: { id: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const q = useQuery(`creator:draft:${id}`, () => api.creator.draft(id));
  const checks = useQuery(`creator:checks:${id}`, () => api.creator.checks(id));
  const status = useQuery('marketplace:status', () => api.marketplace.status());
  const [d, setD] = useState<ListingDraftInput | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) setD({ title: q.data.title, summary: q.data.summary, preview: q.data.preview, body: q.data.body, category: q.data.category, tags: q.data.tags, providers: q.data.providers, pricing: q.data.pricing, trialEligible: q.data.trialEligible, version: q.data.version, changelog: q.data.changelog });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.id]);
  if (q.error) return <EmptyState title="Listing not found" action={<Button onClick={() => navigate('/creator')}>Creator Studio</Button>} />;
  if (!q.data || !d) return <Loading />;
  const saved = q.data;
  const dirty = JSON.stringify(d) !== JSON.stringify({ title: saved.title, summary: saved.summary, preview: saved.preview, body: saved.body, category: saved.category, tags: saved.tags, providers: saved.providers, pricing: saved.pricing, trialEligible: saved.trialEligible, version: saved.version, changelog: saved.changelog });
  const signedIn = !!status.data?.account;
  const run = async (label: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(label);
    try {
      await fn();
      invalidate('creator');
      toast(ok, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };
  const save = () => run('save', () => api.creator.updateDraft(id, d), 'Saved');
  const paid = d.pricing.type === 'paid';

  return (
    <div className="stack-4">
      <div className="row">
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => navigate('/creator')}>
          Creator Studio
        </Button>
        <span className="spacer" />
        <StatusBadge remote={saved.remoteStatus} />
      </div>
      {saved.remoteStatus === 'rejected' && saved.moderationNote ? (
        <Banner tone="warn" title="The moderators asked for changes">
          {saved.moderationNote}
        </Banner>
      ) : null}
      {saved.remoteStatus === 'removed' ? <Banner tone="danger" title="Removed by a moderator">{saved.moderationNote ?? 'No reason was given.'}</Banner> : null}
      {saved.remoteStatus === 'published' ? <p className="small muted">Saving and publishing again sends your changes for review; the listing is hidden until it is approved.</p> : null}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(320px, 1.3fr) minmax(260px, 1fr)', alignItems: 'start' }}>
        <div className="card stack-3">
          <Field label="Title" htmlFor="ld-title">
            <Input id="ld-title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          </Field>
          <Field label="Summary" htmlFor="ld-sum" hint="One or two sentences shown in search results.">
            <Input id="ld-sum" value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} />
          </Field>
          <Field label="Preview" htmlFor="ld-prev" hint="Shown to people before they have access (important for paid listings). Describe it; don’t paste the prompt.">
            <Textarea id="ld-prev" rows={2} value={d.preview} onChange={(e) => setD({ ...d, preview: e.target.value })} />
          </Field>
          <Field label="Prompt" htmlFor="ld-body" hint="Use {{name}} or {{name:default}} for parts people fill in.">
            <Textarea id="ld-body" className="mono" rows={10} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
          </Field>
          <div className="field-row">
            <Field label="Category" htmlFor="ld-cat">
              <Select id="ld-cat" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
                {[...new Set([...PROMPT_CATEGORIES, d.category])].map((c) => (
                  <option key={c} value={c}>
                    {cap(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tags" htmlFor="ld-tags" hint="Comma separated">
              <Input id="ld-tags" value={d.tags.join(', ')} onChange={(e) => setD({ ...d, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
            </Field>
          </div>
          <Field label="Works with">
            <div className="row-wrap" style={{ gap: 4 }} role="group" aria-label="Works with">
              {PROVIDER_LABELS.map((pl) => {
                const on = d.providers.includes(pl.value);
                return (
                  <button
                    key={pl.value}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => {
                      if (pl.value === 'any') return setD({ ...d, providers: ['any'] });
                      const cur = d.providers.filter((x) => x !== 'any');
                      const next = on ? cur.filter((x) => x !== pl.value) : [...cur, pl.value];
                      setD({ ...d, providers: next.length ? next : ['any'] });
                    }}
                  >
                    {pl.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Price">
            <Segmented
              label="Price"
              value={d.pricing.type}
              onChange={(t) => setD({ ...d, pricing: t === 'free' ? { type: 'free' } : { type: 'paid', priceCents: 299, currency: 'USD' }, trialEligible: t === 'paid' ? d.trialEligible : false })}
              options={[
                { value: 'free', label: 'Free' },
                { value: 'paid', label: 'Paid' },
              ]}
            />
          </Field>
          {d.pricing.type === 'paid' ? (
            <div className="stack-3">
              <div className="field-row">
                <Field label="Amount" htmlFor="ld-price">
                  <Input
                    id="ld-price"
                    type="number"
                    min={0.99}
                    step={0.01}
                    value={(d.pricing.priceCents / 100).toFixed(2)}
                    onChange={(e) => setD({ ...d, pricing: { ...(d.pricing as { type: 'paid'; priceCents: number; currency: 'USD' }), priceCents: Math.round(Number(e.target.value) * 100) || 0 } })}
                  />
                </Field>
                <Field label="Currency" htmlFor="ld-cur">
                  <Select id="ld-cur" value={d.pricing.currency} onChange={(e) => setD({ ...d, pricing: { ...(d.pricing as { type: 'paid'; priceCents: number }), type: 'paid', currency: e.target.value as 'USD' } })}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </Select>
                </Field>
              </div>
              <Toggle checked={d.trialEligible} onChange={(v) => setD({ ...d, trialEligible: v })} label="Offer a free 7-day trial" description="The marketplace server grants and ends trials." />
              <p className="tiny faint">Paid listings can only be published to a marketplace server and cannot be shared as files. FlowCompanion has no payment system; whether a listing can actually be bought depends on the server.</p>
            </div>
          ) : null}
          <div className="field-row">
            <Field label="Version" htmlFor="ld-ver" hint="Change it (e.g. 1.1.0) to record a new version.">
              <Input id="ld-ver" value={d.version} onChange={(e) => setD({ ...d, version: e.target.value })} />
            </Field>
            <Field label="What changed" htmlFor="ld-chg">
              <Input id="ld-chg" value={d.changelog} onChange={(e) => setD({ ...d, changelog: e.target.value })} />
            </Field>
          </div>
          <div className="row">
            <Button
              variant="ghost"
              icon={<Trash2 size={14} />}
              onClick={async () => {
                if (!(await confirm({ title: 'Delete this listing?', message: 'The draft and its version history will be deleted from this computer.', confirmLabel: 'Delete', danger: true }))) return;
                try {
                  await api.creator.deleteDraft(id);
                  invalidate('creator');
                  navigate('/creator');
                } catch (err) {
                  toast(errorMessage(err), 'error');
                }
              }}
            >
              Delete
            </Button>
            <span className="spacer" />
            <span className="small muted">{dirty ? 'Unsaved changes' : 'Saved'}</span>
            <Button variant="primary" disabled={!dirty} loading={busy === 'save'} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </div>
        <div className="stack-4">
          <div className="card stack-3">
            <h3>Before you publish</h3>
            {dirty ? <p className="small muted">Save to update this checklist.</p> : null}
            <ul className="stack-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {checks.data?.map((c) => (
                <li key={c.id} className="row small" style={{ alignItems: 'flex-start', gap: 6 }}>
                  {c.ok ? <CheckCircle2 size={14} color="var(--ok)" aria-label="Done" /> : <Circle size={14} color="var(--warn)" aria-label="Not done" />}
                  <span>
                    {c.label}
                    {c.detail ? <span className="tiny faint" style={{ display: 'block' }}>{c.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              variant="primary"
              icon={<Send size={14} />}
              disabled={dirty || !signedIn}
              loading={busy === 'publish'}
              onClick={() => void run('publish', () => api.creator.publish(id), 'Sent for review')}
              title={!signedIn ? 'Sign in to a marketplace server first' : undefined}
            >
              {saved.remoteId ? 'Publish changes' : 'Publish to marketplace server'}
            </Button>
            {!signedIn ? <p className="tiny faint">Publishing needs a marketplace server and an account (Settings → Marketplace).</p> : <p className="tiny faint">A moderator reviews every listing before it appears.</p>}
            {saved.remoteId ? (
              <Button size="sm" variant="ghost" loading={busy === 'unpublish'} onClick={() => void run('unpublish', () => api.creator.unpublish(id), 'Removed from the server')}>
                Unpublish from server
              </Button>
            ) : null}
            <Button size="sm" icon={<Download size={13} />} disabled={dirty || paid} onClick={() => void api.creator.exportPackage(id).then((r) => r.saved && toast('Listing file saved', 'success')).catch((e: unknown) => toast(errorMessage(e), 'error'))}>
              Export as a file
            </Button>
            <p className="tiny faint">Free listings can be shared as a .flowprompt.json file that others import in their Marketplace.</p>
          </div>
          <Analytics id={id} />
        </div>
      </div>
    </div>
  );
}

export default function Creator() {
  const route = useRoute();
  const id = route.segments[1];
  return <div className="page" style={{ maxWidth: 1180 }}>{id ? <Editor key={id} id={id} /> : <Home />}</div>;
}

import { DateTime } from 'luxon';
import { ArrowLeft, BadgeCheck, BookmarkPlus, Flag, Package, Search, ShieldAlert, Star, Store, Upload } from 'lucide-react';
import { useState } from 'react';
import type { AbuseReport, Listing, ListingDetail, ListingQuery } from '../../../shared/types';
import { PROMPT_CATEGORIES, PROVIDER_LABELS } from '../../../shared/prompts';
import { PromptUse } from '../../components/PromptUse';
import { Badge, Banner, Button, EmptyState, ErrorState, Field, Input, Loading, Modal, Select, Tabs, Textarea, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtMoney, fmtRelative } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { MarketplaceAccount } from './Account';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const enc = encodeURIComponent;

export function priceLabel(l: Listing): string {
  return l.pricing.type === 'free' ? 'Free' : fmtMoney(l.pricing.priceCents, l.pricing.currency);
}

export function SourceBadge({ l }: { l: Listing }) {
  if (l.demo) return <Badge tone="warn">Demo data</Badge>;
  if (l.origin === 'bundled') return <Badge tone="outline">Bundled with FlowCompanion</Badge>;
  if (l.imported) return <Badge tone="warn">Imported file · not reviewed</Badge>;
  if (l.origin === 'remote') return <Badge tone="outline">Marketplace server</Badge>;
  return null;
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} out of 5`} className="row" style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={12} color="var(--warn)" fill={n <= Math.round(value) ? 'var(--warn)' : 'none'} aria-hidden />
      ))}
    </span>
  );
}

function ListingCard({ l }: { l: Listing }) {
  return (
    <button type="button" className="card stack-2 interactive" style={{ textAlign: 'left' }} onClick={() => navigate(`/marketplace/listing/${enc(l.key)}`)} aria-label={`${l.title} by ${l.creatorName}, ${priceLabel(l)}`}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <h3 className="grow" style={{ fontSize: '0.98rem' }}>
          {l.title}
        </h3>
        <strong className="small nowrap">{priceLabel(l)}</strong>
      </div>
      <div className="tiny faint">{l.creatorName}</div>
      <p className="small muted">{l.summary}</p>
      <div className="row-wrap" style={{ gap: 4 }}>
        <Badge>{cap(l.category)}</Badge>
        <SourceBadge l={l} />
        {l.pricing.type === 'paid' && l.trialEligible ? <Badge tone="accent">Free trial</Badge> : null}
        {l.rating ? (
          <span className="row tiny muted" style={{ gap: 4 }}>
            <Stars value={l.rating.average} /> {l.rating.average.toFixed(1)} ({l.rating.count})
          </span>
        ) : null}
      </div>
    </button>
  );
}

function Browse() {
  const { settings } = useSettings();
  const toast = useToast();
  const [q, setQ] = useState<ListingQuery>({ sort: 'title' });
  const list = useQuery(`marketplace:list:${JSON.stringify(q)}:${settings.marketplace.serverUrl}:${settings.marketplace.showPaidListings}`, () => api.marketplace.listings(q));
  const items = list.data?.items ?? [];
  return (
    <div className="stack-4">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <h1>Marketplace</h1>
          <p className="muted" style={{ marginTop: 4, maxWidth: 720 }}>
            Prompts you can use, save to your library and adapt. The starter set is free and bundled with the app.{' '}
            {settings.marketplace.serverUrl ? 'Listings from your marketplace server appear alongside it.' : 'Connect a marketplace server to see community listings.'}
          </p>
        </div>
        <Button
          size="sm"
          icon={<Upload size={13} />}
          onClick={() =>
            void api.creator
              .importPackage()
              .then((l) => l && (invalidate('marketplace'), navigate(`/marketplace/listing/${enc(l.key)}`)))
              .catch((e: unknown) => toast(errorMessage(e), 'error'))
          }
        >
          Import listing file
        </Button>
      </div>
      <div className="row-wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--text-faint)' }} aria-hidden />
          <Input placeholder="Search listings" aria-label="Search listings" value={q.search ?? ''} onChange={(e) => setQ({ ...q, search: e.target.value })} style={{ paddingLeft: 28 }} />
        </div>
        <Select aria-label="Category" value={q.category ?? 'all'} onChange={(e) => setQ({ ...q, category: e.target.value })} style={{ width: 160 }}>
          <option value="all">All categories</option>
          {PROMPT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {cap(c)}
            </option>
          ))}
        </Select>
        <Select aria-label="Price" value={q.pricing ?? 'any'} onChange={(e) => setQ({ ...q, pricing: e.target.value as ListingQuery['pricing'] })} style={{ width: 130 }}>
          <option value="any">Any price</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </Select>
        <Select aria-label="Source" value={q.origin ?? 'any'} onChange={(e) => setQ({ ...q, origin: e.target.value as ListingQuery['origin'] })} style={{ width: 170 }}>
          <option value="any">All sources</option>
          <option value="bundled">Bundled starter set</option>
          <option value="local">Imported files</option>
          {settings.marketplace.serverUrl ? <option value="remote">Marketplace server</option> : null}
        </Select>
        <Select aria-label="Sort" value={q.sort ?? 'title'} onChange={(e) => setQ({ ...q, sort: e.target.value as ListingQuery['sort'] })} style={{ width: 140 }}>
          <option value="title">A–Z</option>
          <option value="recent">Newest</option>
          <option value="rating">Best rated</option>
        </Select>
      </div>
      {list.data?.remoteError ? <Banner tone="warn">Marketplace server: {list.data.remoteError} Showing listings available on this computer.</Banner> : null}
      {q.sort === 'rating' ? <p className="tiny faint">Ratings come only from verified reviews on a marketplace server. Bundled and imported prompts have no ratings.</p> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data && !items.length ? <EmptyState icon={<Store size={28} />} title="No listings match">{q.pricing === 'paid' && !settings.marketplace.serverUrl ? 'Paid listings only exist on a marketplace server.' : 'Try a different search.'}</EmptyState> : null}
      <div className="grid grid-3">
        {items.map((l) => (
          <ListingCard key={l.key} l={l} />
        ))}
      </div>
    </div>
  );
}

function TrialModal({ d, onClose }: { d: ListingDetail; onClose: () => void }) {
  const toast = useToast();
  const status = useQuery('marketplace:status', () => api.marketplace.status());
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const days = status.data?.info?.trialDays ?? 7;
  const ends = DateTime.now().plus({ days });
  return (
    <Modal
      title={`Start a ${days}-day free trial`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!ok}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.marketplace.startTrial(d.key, ok);
                invalidate('marketplace');
                toast('Trial started', 'success');
                onClose();
              } catch (err) {
                toast(errorMessage(err), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Start free trial
          </Button>
        </>
      }
    >
      <div className="stack-3 small">
        <p>
          <strong>{d.title}</strong> by {d.creatorName} — {priceLabel(d)} after the trial.
        </p>
        <ul className="stack-2" style={{ paddingLeft: 18, margin: 0 }}>
          <li>You can use the full prompt for {days} days, until about {ends.toLocaleString(DateTime.DATETIME_MED)}.</li>
          <li>The marketplace server decides when the trial ends and stops giving access then. Changing your computer’s clock does not extend it.</li>
          <li>No payment details are asked for and you will not be charged. Nothing is bought automatically when the trial ends.</li>
          <li>One trial per account for each listing. During the trial you can use and copy the prompt, but not save it to your library.</li>
          <li>FlowCompanion reminds you a day before the trial ends (you can turn this off in Settings → Marketplace).</li>
        </ul>
        <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />I understand how this trial works.
        </label>
      </div>
    </Modal>
  );
}

function ReportModal({ d, onClose }: { d: ListingDetail; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<AbuseReport['reason']>('spam');
  const [details, setDetails] = useState('');
  return (
    <Modal
      title="Report this listing"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() =>
              void api.marketplace
                .report(d.key, { reason, details })
                .then((r) => {
                  invalidate('marketplace');
                  toast(r.sentTo === 'server' ? 'Report sent to the marketplace moderators' : 'Reported. It is hidden for you on this computer.', 'success');
                  onClose();
                  if (r.sentTo === 'this_device') navigate('/marketplace');
                })
                .catch((e: unknown) => toast(errorMessage(e), 'error'))
            }
          >
            Send report
          </Button>
        </>
      }
    >
      <div className="stack-3">
        <p className="small muted">
          {d.origin === 'remote' ? 'Your report goes to the moderators of the marketplace server, who can remove the listing.' : 'This listing is stored on your computer, so there is no moderator to send it to. Reporting hides it for you; you can undo this under Reports.'}
        </p>
        <Field label="Reason" htmlFor="rep-reason">
          <Select id="rep-reason" value={reason} onChange={(e) => setReason(e.target.value as AbuseReport['reason'])}>
            <option value="spam">Spam</option>
            <option value="harmful">Harmful or dangerous</option>
            <option value="copyright">Copied without permission</option>
            <option value="misleading">Misleading</option>
            <option value="other">Something else</option>
          </Select>
        </Field>
        <Field label="Details (optional)" htmlFor="rep-details">
          <Textarea id="rep-details" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function Reviews({ d }: { d: ListingDetail }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  return (
    <div className="card stack-3">
      <div className="row">
        <h3 className="grow">{d.reviewsScope === 'server' ? 'Reviews' : 'Your rating'}</h3>
        {d.rating ? (
          <span className="row small" style={{ gap: 6 }}>
            <Stars value={d.rating.average} /> {d.rating.average.toFixed(1)} from {d.rating.count} verified review{d.rating.count === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      <p className="tiny faint">
        {d.reviewsScope === 'server' ? 'Only people who used this prompt (free, trial or purchase) can review it, so every review here is verified.' : 'Ratings of bundled and imported prompts stay on this computer and are only yours. They are never shown as a public rating.'}
      </p>
      {d.reviews.length === 0 ? <p className="small muted">No reviews yet.</p> : null}
      {d.reviews.map((r) => (
        <div key={r.id} className="stack-1">
          <div className="row small" style={{ gap: 6 }}>
            <Stars value={r.rating} />
            <strong>{r.authorName}</strong>
            {r.verified ? (
              <span className="row tiny" style={{ gap: 3, color: 'var(--ok)' }}>
                <BadgeCheck size={12} /> Used this prompt
              </span>
            ) : null}
            <span className="tiny faint">{fmtRelative(r.createdAt)}</span>
          </div>
          {r.text ? <p className="small">{r.text}</p> : null}
        </div>
      ))}
      {d.canReview ? (
        <form
          className="stack-2"
          onSubmit={(e) => {
            e.preventDefault();
            void api.marketplace
              .addReview(d.key, { rating, text })
              .then(() => (invalidate('marketplace'), setText(''), toast('Thanks for your review', 'success')))
              .catch((er: unknown) => toast(errorMessage(er), 'error'));
          }}
        >
          <div className="row" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} className="icon-btn sm" onClick={() => setRating(n)}>
                <Star size={16} color="var(--warn)" fill={n <= rating ? 'var(--warn)' : 'none'} />
              </button>
            ))}
          </div>
          <Textarea aria-label="Review text" rows={3} placeholder="What worked, what didn’t? (optional)" value={text} onChange={(e) => setText(e.target.value)} />
          <div>
            <Button type="submit" size="sm" disabled={!rating}>
              {d.reviewsScope === 'server' ? 'Post review' : 'Save rating'}
            </Button>
          </div>
        </form>
      ) : d.reviewBlockedReason ? (
        <p className="small muted">{d.reviewBlockedReason}</p>
      ) : null}
    </div>
  );
}

function Detail({ listingKey }: { listingKey: string }) {
  const toast = useToast();
  const q = useQuery(`marketplace:listing:${listingKey}`, () => api.marketplace.listing(listingKey));
  const [trial, setTrial] = useState(false);
  const [report, setReport] = useState(false);
  if (q.error) return <ErrorState error={q.error} onRetry={() => navigate('/marketplace')} />;
  if (!q.data) return <Loading />;
  const d = q.data;
  const a = d.access;
  const hasAccess = a.access === 'free' || a.access === 'trial_active' || a.access === 'purchased';
  const save = () =>
    void api.marketplace
      .saveToLibrary(d.key)
      .then((p) => (invalidate('prompts'), invalidate('marketplace'), toast('Saved to your Prompt Library', 'success'), navigate(`/prompts/${p.id}`)))
      .catch((e: unknown) => toast(errorMessage(e), 'error'));

  return (
    <div className="stack-4">
      <div>
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => navigate('/marketplace')}>
          Marketplace
        </Button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(320px, 1fr) minmax(260px, 340px)', alignItems: 'start' }}>
        <div className="stack-4">
          <div className="card stack-3">
            <div className="row-wrap" style={{ gap: 4 }}>
              <SourceBadge l={d} />
              <Badge>{cap(d.category)}</Badge>
              {d.providers.filter((p) => p !== 'any').map((p) => (
                <Badge key={p} tone="outline">
                  {PROVIDER_LABELS.find((x) => x.value === p)?.label ?? p}
                </Badge>
              ))}
            </div>
            <h1 style={{ fontSize: '1.4rem' }}>{d.title}</h1>
            <p className="small muted">
              by{' '}
              <button type="button" className="link-button" style={{ color: 'var(--accent)' }} onClick={() => navigate(`/marketplace/creator/${enc(`${d.origin}:${d.creatorId}`)}`)}>
                {d.creatorName}
              </button>{' '}
              · version {d.version}
              {d.publishedAt && d.origin !== 'bundled' ? ` · published ${fmtRelative(d.publishedAt)}` : ''}
            </p>
            <p>{d.summary}</p>
            {d.demo ? <Banner tone="demo">This is sample data on the marketplace server, made up to show how listings work. It is not a real creator’s product.</Banner> : null}
            {d.imported ? <Banner tone="warn">Imported from a file. Nobody has reviewed it; read the prompt before using it.</Banner> : null}
            {d.body !== null ? (
              <Field label="Prompt">
                <pre className="prompt-preview" style={{ maxHeight: 420 }}>
                  {d.body}
                </pre>
              </Field>
            ) : (
              <Field label="Preview">
                <p className="small">{d.preview || 'The creator has not added a preview.'}</p>
              </Field>
            )}
          </div>
          <Reviews d={d} />
          {d.versions.length > 1 ? (
            <div className="card stack-2">
              <h3>Versions</h3>
              {d.versions.map((v) => (
                <div key={`${v.version}${v.createdAt}`} className="small">
                  <strong>{v.version}</strong> <span className="faint">{fmtRelative(v.createdAt)}</span> {v.changelog ? `— ${v.changelog}` : ''}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="stack-4">
          <div className="card stack-3">
            <div className="row">
              <strong className="grow" style={{ fontSize: '1.2rem' }}>
                {priceLabel(d)}
              </strong>
              {a.access === 'trial_active' ? <Badge tone="accent">Trial</Badge> : null}
            </div>
            <p className="small muted">{a.reason}</p>
            {a.access === 'trial_active' && a.expiresAt ? (
              <p className="small">
                Trial ends {DateTime.fromISO(a.expiresAt).toRelative()} ({DateTime.fromISO(a.expiresAt).toLocaleString(DateTime.DATETIME_MED)}).
              </p>
            ) : null}
            {a.access === 'none' && a.trialAvailable ? (
              <Button variant="primary" onClick={() => setTrial(true)}>
                Start free trial
              </Button>
            ) : null}
            {d.pricing.type === 'paid' && a.access !== 'purchased' ? (
              <Button onClick={() => void api.marketplace.purchase(d.key).catch((e: unknown) => toast(errorMessage(e), 'error'))}>Buy</Button>
            ) : null}
            {hasAccess ? (
              <PromptUse
                body={d.body ?? ''}
                context="marketplace"
                onUse={async (how) => {
                  try {
                    return await api.marketplace.promptText(d.key, how);
                  } catch (err) {
                    toast(errorMessage(err), 'error');
                    throw err;
                  }
                }}
              />
            ) : null}
            {hasAccess && a.access !== 'trial_active' ? (
              d.inLibrary ? (
                <Button variant="ghost" onClick={() => navigate(`/prompts/${d.inLibrary}`)}>
                  Open in your library
                </Button>
              ) : (
                <Button icon={<BookmarkPlus size={14} />} onClick={save}>
                  Save to Prompt Library
                </Button>
              )
            ) : null}
          </div>
          <div className="small muted stack-1">
            <div>
              On this computer you viewed this {d.yourUsage.views} time{d.yourUsage.views === 1 ? '' : 's'}, copied it {d.yourUsage.copies} and opened it in AI {d.yourUsage.inserts} time{d.yourUsage.inserts === 1 ? '' : 's'}.
            </div>
            {d.origin === 'remote' ? <div className="tiny faint">The server counts page views and trials for the creator. Copies and AI use are only counted on this computer.</div> : null}
          </div>
          {!d.isMine ? (
            d.myReport && d.myReport.status === 'open' ? (
              <p className="small muted">
                <ShieldAlert size={13} /> You reported this listing ({d.myReport.reason}).
              </p>
            ) : (
              <Button size="sm" variant="ghost" icon={<Flag size={13} />} onClick={() => setReport(true)}>
                Report listing
              </Button>
            )
          ) : (
            <Button size="sm" variant="ghost" onClick={() => navigate('/creator')}>
              Manage in Creator Studio
            </Button>
          )}
        </div>
      </div>
      {trial ? <TrialModal d={d} onClose={() => setTrial(false)} /> : null}
      {report ? <ReportModal d={d} onClose={() => setReport(false)} /> : null}
    </div>
  );
}

function CreatorPage({ creatorKey }: { creatorKey: string }) {
  const q = useQuery(`marketplace:creator:${creatorKey}`, () => api.marketplace.creator(creatorKey));
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const { creator: c, listings } = q.data;
  return (
    <div className="stack-4">
      <div>
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => history.back()}>
          Back
        </Button>
      </div>
      <div className="card stack-2">
        <h1 style={{ fontSize: '1.4rem' }}>{c.displayName}</h1>
        {c.bio ? <p>{c.bio}</p> : null}
        {c.website ? (
          <button type="button" className="link-button small" style={{ color: 'var(--accent)' }} onClick={() => void api.app.openExternal(c.website)}>
            {c.website}
          </button>
        ) : null}
        <p className="tiny faint">
          {listings.length} published listing{listings.length === 1 ? '' : 's'}
          {c.origin === 'bundled' ? ' · bundled with FlowCompanion' : c.origin === 'local' ? ' · from an imported file' : ''}
        </p>
      </div>
      <div className="grid grid-3">
        {listings.map((l) => (
          <ListingCard key={l.key} l={l} />
        ))}
      </div>
    </div>
  );
}

function Reports() {
  const toast = useToast();
  const confirm = useConfirm();
  const status = useQuery('marketplace:status', () => api.marketplace.status());
  const mine = useQuery('marketplace:reports', () => api.marketplace.myReports());
  const isMod = status.data?.account?.role === 'admin';
  const queue = useQuery(isMod ? 'marketplace:modqueue' : null, () => api.marketplace.moderationQueue());
  const act = (p: Promise<unknown>, msg: string) =>
    void p.then(() => (invalidate('marketplace'), toast(msg, 'success'))).catch((e: unknown) => toast(errorMessage(e), 'error'));
  return (
    <div className="stack-5">
      <section className="stack-3">
        <h2 style={{ fontSize: '1.1rem' }}>Your reports</h2>
        {mine.data?.length === 0 ? <p className="small muted">You haven’t reported anything.</p> : null}
        {mine.data?.map((r) => (
          <div key={r.id} className="card row-wrap" style={{ padding: 12 }}>
            <div className="grow">
              <strong>{r.listingTitle ?? (r.listingId.startsWith('remote:') ? 'Marketplace server listing' : 'Removed listing')}</strong>
              <div className="small muted">
                {cap(r.reason)}
                {r.details ? ` — ${r.details}` : ''} · {fmtRelative(r.createdAt)} · {r.status}
              </div>
            </div>
            {!r.listingId.startsWith('remote:') && r.status === 'open' ? (
              <>
                <Button size="sm" onClick={() => act(api.marketplace.resolveLocalReport(r.id, 'restore'), 'Listing visible again')}>
                  Show it again
                </Button>
                {r.listingId.startsWith('local:') ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (await confirm({ title: 'Remove imported listing?', message: 'It will be deleted from this computer.', confirmLabel: 'Remove', danger: true })) act(api.marketplace.resolveLocalReport(r.id, 'remove_listing'), 'Listing removed');
                    }}
                  >
                    Remove it
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        ))}
      </section>
      {isMod ? (
        <section className="stack-3">
          <h2 style={{ fontSize: '1.1rem' }}>Moderation queue (server)</h2>
          {queue.error ? <ErrorState error={queue.error} /> : null}
          {queue.data && !queue.data.pending.length && !queue.data.reports.length ? <p className="small muted">Nothing waiting.</p> : null}
          {queue.data?.pending.map((l) => (
            <ModItem key={l.id} l={l} />
          ))}
          {queue.data?.reports.map((r) => (
            <div key={r.id} className="card row-wrap" style={{ padding: 12 }}>
              <div className="grow">
                <strong>Report: {r.listingTitle}</strong>
                <div className="small muted">
                  {cap(r.reason)}
                  {r.details ? ` — ${r.details}` : ''} · {fmtRelative(r.createdAt)}
                </div>
              </div>
              <Button size="sm" onClick={() => navigate(`/marketplace/listing/${enc(`remote:${r.listingId}`)}`)}>
                View listing
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(api.marketplace.resolveServerReport(r.id, 'reviewed'), 'Marked reviewed')}>
                Mark reviewed
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(api.marketplace.resolveServerReport(r.id, 'dismissed'), 'Dismissed')}>
                Dismiss
              </Button>
              <Button size="sm" variant="danger" onClick={() => act(api.marketplace.moderate(r.listingId, 'remove', `Removed after a ${r.reason} report`), 'Listing removed')}>
                Remove listing
              </Button>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ModItem({ l }: { l: Listing }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const act = (action: 'approve' | 'reject') =>
    void api.marketplace
      .moderate(l.id, action, note)
      .then(() => (invalidate('marketplace'), toast(action === 'approve' ? 'Published' : 'Rejected', 'success')))
      .catch((e: unknown) => toast(errorMessage(e), 'error'));
  return (
    <div className="card stack-2" style={{ padding: 12 }}>
      <div className="row">
        <div className="grow">
          <strong>{l.title}</strong> <span className="small muted">by {l.creatorName} · {priceLabel(l)} · v{l.version}</span>
          <div className="small muted">{l.summary}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
          {open ? 'Hide prompt' : 'Read prompt'}
        </Button>
      </div>
      {open ? <pre className="prompt-preview">{l.body}</pre> : null}
      <div className="row-wrap">
        <Input aria-label={`Note to the creator of ${l.title}`} placeholder="Note to the creator (required to reject)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <Button size="sm" variant="primary" onClick={() => act('approve')}>
          Approve
        </Button>
        <Button size="sm" onClick={() => act('reject')} disabled={!note.trim()}>
          Reject
        </Button>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const route = useRoute();
  const seg = route.segments[1];
  const arg = route.segments[2] ? decodeURIComponent(route.segments[2]) : null;
  if (seg === 'listing' && arg)
    return (
      <div className="page" style={{ maxWidth: 1180 }}>
        <Detail key={arg} listingKey={arg} />
      </div>
    );
  if (seg === 'creator' && arg)
    return (
      <div className="page" style={{ maxWidth: 1180 }}>
        <CreatorPage creatorKey={arg} />
      </div>
    );
  const tab = (['browse', 'reports', 'account'].includes(seg ?? '') ? seg : 'browse') as 'browse' | 'reports' | 'account';
  return (
    <div className="page stack-4" style={{ maxWidth: 1180 }}>
      <Tabs
        label="Marketplace sections"
        value={tab}
        onChange={(v) => navigate(v === 'browse' ? '/marketplace' : `/marketplace/${v}`)}
        tabs={[
          { value: 'browse', label: 'Browse' },
          { value: 'reports', label: 'Reports & moderation' },
          { value: 'account', label: 'Server & account' },
        ]}
      />
      {tab === 'browse' ? <Browse /> : null}
      {tab === 'reports' ? <Reports /> : null}
      {tab === 'account' ? (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <Package size={16} color="var(--accent)" />
            <h3>Marketplace server</h3>
          </div>
          <MarketplaceAccount />
        </div>
      ) : null}
    </div>
  );
}

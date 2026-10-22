import { ArrowLeft, Compass, Download, Route, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { LearningPathView, LearningQuery } from '../../../shared/types';
import { LEARNING_TOPICS } from '../../../shared/learning';
import { Banner, Button, EmptyState, Input, Loading, ProgressBar, Select, Tabs, useConfirm, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate, useRoute } from '../../lib/router';
import { useSettings } from '../../lib/settings';
import { LEVEL_LABEL, ResourceCard, STATUS_LABEL, TYPE_LABEL } from './common';
import { ResourceDetail } from './ResourceDetail';

function PathCard({ p }: { p: LearningPathView }) {
  return (
    <button type="button" className="card stack-3 interactive" style={{ textAlign: 'left' }} onClick={() => navigate(`/learning/paths/${p.id}`)}>
      <div className="row">
        <Route size={16} color="var(--accent)" />
        <h3 className="grow">{p.title}</h3>
      </div>
      <p className="small muted">{p.audience}</p>
      <ProgressBar value={p.total ? p.completed / p.total : 0} label={`${p.title}: ${p.completed} of ${p.total} steps completed`} />
      <span className="tiny faint">
        {p.completed} of {p.total} steps completed
      </span>
    </button>
  );
}

function ForYou() {
  const { settings } = useSettings();
  const recs = useQuery('learning:recs', () => api.learning.recommendations());
  const all = useQuery('learning:resources:all', () => api.learning.resources());
  const paths = useQuery('learning:paths', () => api.learning.paths());
  const overview = useQuery('learning:overview', () => api.learning.overview());
  const inProgress = all.data?.filter((r) => r.progress?.status === 'in_progress') ?? [];
  if (!recs.data || !all.data || !paths.data) return <Loading />;
  const byId = new Map(all.data.map((r) => [r.id, r]));
  const started = paths.data.filter((p) => p.started);
  return (
    <div className="stack-5">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <h1>Learning Hub</h1>
          <p className="muted" style={{ marginTop: 4, maxWidth: 680 }}>
            Free, reputable resources for learning about AI — from first steps to research papers. Everything here can be used without paying; some sites offer optional paid extras, which we always point out.
          </p>
        </div>
      </div>
      {overview.data ? (
        <p className="row small muted" style={{ gap: 6 }}>
          <ShieldCheck size={14} color="var(--ok)" />
          {overview.data.verified} of {overview.data.total} links verified{overview.data.checkedOn ? ` on ${overview.data.checkedOn}` : ''}.
        </p>
      ) : null}
      {inProgress.length ? (
        <section className="stack-3" aria-label="Continue learning">
          <h2 style={{ fontSize: '1.1rem' }}>Continue learning</h2>
          <div className="grid grid-2">
            {inProgress.slice(0, 4).map((r) => (
              <ResourceCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="stack-3" aria-label="Suggested for you">
        <div className="row">
          <h2 className="grow" style={{ fontSize: '1.1rem' }}>
            {recs.data.personalized ? 'Suggested for you' : 'Good places to start'}
          </h2>
          <Button size="sm" variant="ghost" onClick={() => navigate('/settings/learning')}>
            {settings.learning.goals.length ? 'Change goals' : 'Choose goals'}
          </Button>
        </div>
        {!recs.data.personalized ? <p className="small muted">Personalized suggestions are off (Settings → Privacy). Everyone sees the same starting points.</p> : null}
        {recs.data.personalized && !settings.learning.goals.length && !settings.privacy.useActivityForPersonalization ? (
          <p className="small muted">Pick learning goals in Settings → Learning to tailor these suggestions.</p>
        ) : null}
        <div className="grid grid-2">
          {recs.data.items.map((it) => {
            const r = byId.get(it.resourceId);
            return r ? <ResourceCard key={it.resourceId} r={r} reason={it.reason} /> : null;
          })}
        </div>
      </section>
      <section className="stack-3" aria-label="Learning paths">
        <div className="row">
          <h2 className="grow" style={{ fontSize: '1.1rem' }}>
            {started.length ? 'Your paths' : 'Learning paths'}
          </h2>
          <Button size="sm" variant="ghost" onClick={() => navigate('/learning/paths')}>
            All paths
          </Button>
        </div>
        <div className="grid grid-3">
          {(started.length ? started : paths.data.slice(0, 3)).map((p) => (
            <PathCard key={p.id} p={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Paths() {
  const paths = useQuery('learning:paths', () => api.learning.paths());
  if (!paths.data) return <Loading />;
  return (
    <div className="stack-4">
      <p className="muted">Each path is an ordered list of free resources chosen for a particular audience. Mark steps complete as you go — progress is stored only on this computer.</p>
      <div className="grid grid-3">
        {paths.data.map((p) => (
          <PathCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}

function PathDetail({ id }: { id: string }) {
  const p = useQuery(`learning:path:${id}`, () => api.learning.path(id));
  if (p.error) return <EmptyState title="Path not found" action={<Button onClick={() => navigate('/learning/paths')}>All paths</Button>} />;
  if (!p.data) return <Loading />;
  const d = p.data;
  return (
    <div className="stack-4" style={{ maxWidth: 860 }}>
      <div>
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => navigate('/learning/paths')}>
          All paths
        </Button>
      </div>
      <div className="stack-3">
        <h1 style={{ fontSize: '1.4rem' }}>{d.title}</h1>
        <p className="muted">{d.description}</p>
        <p className="small">
          <strong>For:</strong> {d.audience}
        </p>
        <ProgressBar value={d.total ? d.completed / d.total : 0} label={`${d.completed} of ${d.total} steps completed`} />
        <span className="small muted">
          {d.completed} of {d.total} steps completed
          {d.nextResourceId ? '' : ' — path complete!'}
        </span>
      </div>
      <ol className="stack-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {d.resources.map((r, i) => (
          <li key={r.id}>
            <ResourceCard r={r} step={{ n: i + 1, why: d.steps[i]!.why }} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Library({ mine }: { mine: boolean }) {
  const [q, setQ] = useState<LearningQuery>(mine ? { savedOnly: false } : {});
  const [mineFilter, setMineFilter] = useState<'saved' | 'in_progress' | 'completed'>('saved');
  const effective: LearningQuery = mine ? (mineFilter === 'saved' ? { ...q, savedOnly: true } : { ...q, status: mineFilter }) : q;
  const list = useQuery(`learning:list:${JSON.stringify(effective)}`, () => api.learning.resources(effective));
  const set = (patch: LearningQuery) => setQ((cur) => ({ ...cur, ...patch }));
  return (
    <div className="stack-4">
      {mine ? (
        <Tabs
          label="My learning filter"
          value={mineFilter}
          onChange={setMineFilter}
          tabs={[
            { value: 'saved', label: 'Saved' },
            { value: 'in_progress', label: STATUS_LABEL.in_progress },
            { value: 'completed', label: STATUS_LABEL.completed },
          ]}
        />
      ) : null}
      <div className="row-wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--text-faint)' }} aria-hidden />
          <Input placeholder="Search resources and your notes" aria-label="Search learning resources" value={q.search ?? ''} onChange={(e) => set({ search: e.target.value })} style={{ paddingLeft: 28 }} />
        </div>
        <Select aria-label="Topic" value={q.topic ?? 'any'} onChange={(e) => set({ topic: e.target.value })} style={{ width: 170 }}>
          <option value="any">All topics</option>
          {LEARNING_TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Level" value={q.level ?? 'any'} onChange={(e) => set({ level: e.target.value as LearningQuery['level'] })} style={{ width: 140 }}>
          <option value="any">Any level</option>
          {Object.entries(LEVEL_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select aria-label="Format" value={q.type ?? 'any'} onChange={(e) => set({ type: e.target.value as LearningQuery['type'] })} style={{ width: 150 }}>
          <option value="any">Any format</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select aria-label="Sign-up" value={q.registration ?? 'any'} onChange={(e) => set({ registration: e.target.value as LearningQuery['registration'] })} style={{ width: 170 }}>
          <option value="any">Any sign-up</option>
          <option value="none">No sign-up</option>
          <option value="optional">Sign-up optional</option>
          <option value="required">Sign-up required</option>
        </Select>
      </div>
      {list.data ? (
        <p className="small muted" role="status">
          {list.data.length} resource{list.data.length === 1 ? '' : 's'}
        </p>
      ) : null}
      {list.data?.length === 0 ? (
        <EmptyState icon={<Compass size={28} />} title={mine ? 'Nothing here yet' : 'No matching resources'}>
          {mine ? 'Save resources or mark your progress and they will appear here.' : 'Try a different search or fewer filters.'}
        </EmptyState>
      ) : null}
      <div className="grid grid-2">
        {list.data?.map((r) => (
          <ResourceCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}

function DataFooter() {
  const toast = useToast();
  const confirm = useConfirm();
  return (
    <div className="row-wrap small muted" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <span className="grow">Your progress, saved items and notes stay on this computer.</span>
      <Button
        size="sm"
        variant="ghost"
        icon={<Download size={13} />}
        onClick={() =>
          void api.learning
            .exportData()
            .then((r) => r.saved && toast('Learning data exported', 'success'))
            .catch((e: unknown) => toast(errorMessage(e), 'error'))
        }
      >
        Export my learning data
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          if (!(await confirm({ title: 'Delete learning data?', message: 'This removes your progress, saved resources and notes on resources, and links from other items to resources. The catalog itself stays.', confirmLabel: 'Delete', danger: true }))) return;
          const n = await api.learning.deleteData();
          invalidate('learning');
          toast(`Deleted learning data for ${n} resource${n === 1 ? '' : 's'}`, 'success');
        }}
      >
        Delete learning data
      </Button>
    </div>
  );
}

export default function Learning() {
  const route = useRoute();
  const seg = route.segments[1] ?? 'home';
  if (seg === 'resource' && route.segments[2]) {
    return (
      <div className="page" style={{ maxWidth: 1180 }}>
        <ResourceDetail id={route.segments[2]} />
      </div>
    );
  }
  const tab = (['home', 'paths', 'library', 'mine'].includes(seg) ? seg : 'home') as 'home' | 'paths' | 'library' | 'mine';
  return (
    <div className="page stack-4" style={{ maxWidth: 1180 }}>
      <Tabs
        label="Learning Hub sections"
        value={tab}
        onChange={(v) => navigate(v === 'home' ? '/learning' : `/learning/${v}`)}
        tabs={[
          { value: 'home', label: 'For you' },
          { value: 'paths', label: 'Paths' },
          { value: 'library', label: 'Library' },
          { value: 'mine', label: 'My learning' },
        ]}
      />
      {tab === 'home' ? <ForYou /> : null}
      {tab === 'paths' ? route.segments[2] ? <PathDetail id={route.segments[2]} /> : <Paths /> : null}
      {tab === 'library' ? <Library mine={false} /> : null}
      {tab === 'mine' ? <Library mine /> : null}
      {tab === 'mine' || tab === 'library' ? <DataFooter /> : null}
      {tab === 'home' ? (
        <Banner tone="info">
          Resources come from universities, non-profits, public bodies and companies. FlowCompanion isn’t paid to list any of them, and links open in your own browser.
        </Banner>
      ) : null}
    </div>
  );
}

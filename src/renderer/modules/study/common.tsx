import { useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { MASTERY_LABEL, type MasteryStatus, type StudentProfile } from '../../../shared/study/types';
import { VERIFICATION_LABEL, type VerificationStatus } from '../../../shared/curriculum/types';
import { Badge, Banner, Button, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useQuery } from '../../lib/query';
import type { CourseProgressRow } from '../../../shared/study/api';
import type { Block } from '../../../shared/study/types';
import { unitLabel, type TopicInfo } from '../../../shared/study/topics';
import { Blocks } from './render';
import { navigate } from '../../lib/router';

const STATUS_TONE: Record<MasteryStatus, 'accent' | 'ok' | 'warn' | 'danger' | 'info' | 'outline'> = {
  not_assessed: 'outline',
  not_yet: 'danger',
  in_progress: 'warn',
  developing: 'info',
  proficient: 'ok',
  extension_ready: 'accent',
  review: 'warn',
};

/** A learning indicator. The title reminds everyone it is not an Ontario achievement level. */
export function StatusBadge({ status, estimate }: { status: MasteryStatus; estimate?: number | null }) {
  return (
    <Badge tone={STATUS_TONE[status]} title="FlowCompanion learning indicator, based only on answers checked in the app. Not an Ontario achievement level or mark, and not a guarantee that this expectation is fully met.">
      {MASTERY_LABEL[status]}
      {estimate !== null && estimate !== undefined && status !== 'not_assessed' ? ` · ${Math.round(estimate * 100)}%` : ''}
    </Badge>
  );
}

export function VerificationBadge({ v }: { v: VerificationStatus }) {
  const tone = v === 'verified' ? 'ok' : v === 'pdf_only' ? 'info' : 'warn';
  const short: Record<VerificationStatus, string> = { verified: 'Official', pdf_only: 'PDF only', unverified: 'Unverified', changed_upstream: 'Changed by the Ministry', removed_upstream: 'No longer published' };
  return (
    <Badge tone={tone} title={VERIFICATION_LABEL[v]}>
      {short[v]}
    </Badge>
  );
}

export function ExpLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <button type="button" className="link-button" onClick={() => navigate(`/study/e/${encodeURIComponent(id)}`)}>
      {children}
    </button>
  );
}

/** A link to an expectation by its topic name ("Scientific notation B2.1") rather than its bare code. */
export function TopicLink({ id }: { id: string }) {
  const t = useQuery(`study:topic:${id}`, () => api.study.topic(id));
  return (
    <ExpLink id={id}>
      {t.data ? t.data.topic : indexOf(id)}
      {t.data ? <span className="tiny faint"> {indexOf(id)}</span> : null}
    </ExpLink>
  );
}

/** Index of an expectation id, e.g. "on-mth1w:B2.1" → "B2.1". */
export const indexOf = (id: string) => id.split(':').pop() ?? id;

/** Style variables for the student's accessibility preferences, applied to the whole workspace. */
export function studentStyle(p: StudentProfile | null | undefined): React.CSSProperties {
  if (!p) return {};
  return {
    ['--study-scale' as string]: String(p.accessibility.textScale),
    fontFamily: p.accessibility.readableFont ? 'Verdana, "Atkinson Hyperlegible", Tahoma, sans-serif' : undefined,
    letterSpacing: p.accessibility.readableFont ? '0.01em' : undefined,
  };
}

export const WEEKDAYS: { d: 1 | 2 | 3 | 4 | 5 | 6 | 7; label: string }[] = [
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
  { d: 7, label: 'Sun' },
];

/** The same words everywhere a student sees progress, marks-like numbers or "done". */
export const NO_GUARANTEE =
  'FlowCompanion is a learning tool. It can’t guarantee good marks, and progress here — bars, statuses and percentages — doesn’t mean you’ve met every curriculum requirement. It only counts answers checked in the app; many expectations (projects, labs, discussion, writing, presentations) can’t be fully checked here. Your teacher’s assessment is what counts.';

/** A visible reminder that this is a learning aid, not an assessment. `compact` for a line under progress bars. */
export function NoGuaranteeNotice({ compact = false }: { compact?: boolean }) {
  if (compact) return <p className="tiny muted no-guarantee">{NO_GUARANTEE}</p>;
  return (
    <Banner tone="info" title="A learning tool, not a guarantee">
      {NO_GUARANTEE}
    </Banner>
  );
}

/** "Unit B: Number" over the topic name, with the Ministry number small. Used wherever a student picks what to study. */
export function TopicHeading({ t, index, course, as = 'strong' }: { t: TopicInfo; index: string; course?: string; as?: 'strong' | 'h1' }) {
  const Title = as;
  return (
    <div className="topic-heading">
      <div className="tiny muted">
        {unitLabel(t)}
        {course ? ` · ${course}` : ''}
      </div>
      <Title className="topic-title">
        {t.topic} <span className="topic-index">{index}</span>
      </Title>
    </div>
  );
}

/**
 * What the student will learn, in plain words: FlowCompanion's "I can …" goal where it wrote a lesson, or an AI rewrite
 * on request. The Ministry's exact wording stays one click away.
 */
export function PlainWords({ expectationId, goal, official, aiOk, openOfficial = false }: { expectationId: string; goal: string | null; official: string; aiOk: boolean; openOfficial?: boolean }) {
  const toast = useToast();
  const [plain, setPlain] = useState<{ blocks: Block[]; providerName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const explain = async () => {
    setBusy(true);
    try {
      setPlain(await api.study.plainWords(expectationId));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="plain-words stack-2">
      {goal ? (
        <p className="small">
          <strong>Your goal:</strong> {goal}
        </p>
      ) : null}
      {plain ? (
        <div className="plain-ai small">
          <Blocks blocks={plain.blocks} />
          <p className="tiny faint">In plain words by {plain.providerName} (AI). Check the official wording if anything seems off.</p>
        </div>
      ) : !goal && aiOk ? (
        <div>
          <Button size="sm" variant="ghost" icon={<Sparkles size={13} />} loading={busy} onClick={() => void explain()}>
            Explain this in plain words
          </Button>
        </div>
      ) : null}
      {official ? (
        <details className="official-wording" open={openOfficial || (!goal && !plain && !aiOk)}>
          <summary className="tiny muted">Official Ontario wording</summary>
          <p className="small muted">{official}</p>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Choose expectations by unit and topic instead of by code. Each topic can be ticked as a whole. `usable` can grey out
 * rows that cannot be used (returning why).
 */
export function TopicPicker({ rows, value, onChange, usable, aside }: { rows: CourseProgressRow[]; value: string[]; onChange: (v: string[]) => void; usable?: (r: CourseProgressRow) => string | null; aside?: (r: CourseProgressRow) => ReactNode }) {
  const units = new Map<string, { label: string; groups: Map<string, CourseProgressRow[]> }>();
  for (const r of rows) {
    const key = r.topic.unitIndex || r.topic.unit;
    const u = units.get(key) ?? { label: unitLabel(r.topic), groups: new Map() };
    u.groups.set(r.group, [...(u.groups.get(r.group) ?? []), r]);
    units.set(key, u);
  }
  const toggle = (ids: string[], on: boolean) => onChange(on ? [...new Set([...value, ...ids])] : value.filter((x) => !ids.includes(x)));
  return (
    <div className="expectation-picker topic-picker">
      {[...units.entries()].map(([k, u]) => (
        <div key={k} className="topic-unit">
          <div className="topic-unit-label">{u.label}</div>
          {[...u.groups.entries()].map(([g, items]) => {
            const ids = items.filter((r) => !usable?.(r)).map((r) => r.expectationId);
            const all = ids.length > 0 && ids.every((x) => value.includes(x));
            return (
              <div key={g} className="topic-group">
                <label className="row small topic-group-label">
                  <input type="checkbox" disabled={!ids.length} checked={all} onChange={(e) => toggle(ids, e.target.checked)} />
                  <strong className="grow">{g}</strong>
                  <span className="tiny faint">{items.length} expectation{items.length === 1 ? '' : 's'}</span>
                </label>
                {items.map((r) => {
                  const why = usable?.(r) ?? null;
                  return (
                    <label key={r.expectationId} className={`row small topic-item ${why ? 'faint' : ''}`} title={why ?? r.text}>
                      <input type="checkbox" disabled={!!why} checked={value.includes(r.expectationId)} onChange={(e) => toggle([r.expectationId], e.target.checked)} />
                      <span className="grow topic-item-text">
                        {r.topic.goal ? <strong>{r.topic.topic}</strong> : <span className="clamp-2">{r.text}</span>}
                        <span className="tiny faint"> {r.index}</span>
                      </span>
                      {aside?.(r)}
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

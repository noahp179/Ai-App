import { Bookmark, BookmarkCheck, CheckCircle2, CircleDot, ExternalLink } from 'lucide-react';
import type { LearningResourceView, ResourceStatus } from '../../../shared/types';
import { topicLabel } from '../../../shared/learning';
import { Badge, IconButton, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { invalidate } from '../../lib/query';
import { navigate } from '../../lib/router';

export const TYPE_LABEL: Record<LearningResourceView['type'], string> = {
  article: 'Article',
  guide: 'Guide',
  video: 'Video',
  course: 'Course',
  exercise: 'Interactive',
  documentation: 'Documentation',
  project: 'Projects',
  book: 'Book',
};
export const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;
export const REGISTRATION_LABEL = { none: 'No sign-up', optional: 'Sign-up optional', required: 'Free sign-up required' } as const;
export const STATUS_LABEL: Record<ResourceStatus, string> = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed' };

export function useLearningActions() {
  const toast = useToast();
  const run = async (p: Promise<unknown>, ok?: string) => {
    try {
      await p;
      invalidate('learning');
      if (ok) toast(ok, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return {
    open: (id: string) => run(api.learning.open(id)),
    save: (id: string, saved: boolean) => run(api.learning.setSaved(id, saved), saved ? 'Saved to My learning' : undefined),
    status: (id: string, s: ResourceStatus) => run(api.learning.setStatus(id, s)),
  };
}

export function StatusBadge({ status }: { status: ResourceStatus | undefined }) {
  if (!status || status === 'not_started') return null;
  return status === 'completed' ? (
    <Badge tone="ok">
      <CheckCircle2 size={11} /> Completed
    </Badge>
  ) : (
    <Badge tone="accent">
      <CircleDot size={11} /> In progress
    </Badge>
  );
}

/** One resource in a list. The whole card opens the detail page; the icons act directly. */
export function ResourceCard({ r, reason, step }: { r: LearningResourceView; reason?: string; step?: { n: number; why: string } }) {
  const act = useLearningActions();
  const saved = !!r.progress?.saved;
  return (
    <article className="card stack-3" aria-label={r.title} style={{ padding: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {step ? (
          <span className={`step-dot ${r.progress?.status === 'completed' ? 'done' : ''}`} aria-label={`Step ${step.n}${r.progress?.status === 'completed' ? ', completed' : ''}`}>
            {r.progress?.status === 'completed' ? <CheckCircle2 size={14} /> : step.n}
          </span>
        ) : null}
        <div className="grow" style={{ minWidth: 0 }}>
          <button type="button" className="link-button" onClick={() => navigate(`/learning/resource/${r.id}`)} style={{ fontWeight: 600, textAlign: 'left' }}>
            {r.title}
          </button>
          <div className="tiny faint" style={{ marginTop: 2 }}>
            {r.publisher}
          </div>
        </div>
        <IconButton label={saved ? 'Remove from My learning' : 'Save to My learning'} size="sm" active={saved} onClick={() => void act.save(r.id, !saved)}>
          {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        </IconButton>
        <IconButton label={`Open ${r.title} in your browser`} size="sm" onClick={() => void act.open(r.id)}>
          <ExternalLink size={14} />
        </IconButton>
      </div>
      {step ? <p className="small">{step.why}</p> : null}
      {reason ? <p className="small" style={{ color: 'var(--accent)' }}>{reason}</p> : null}
      {!step ? <p className="small muted">{r.summary}</p> : null}
      <div className="row-wrap" style={{ gap: 4 }}>
        <Badge tone="outline">{TYPE_LABEL[r.type]}</Badge>
        <Badge tone="outline">{LEVEL_LABEL[r.level]}</Badge>
        <Badge tone={r.registration === 'required' ? 'warn' : 'outline'}>{REGISTRATION_LABEL[r.registration]}</Badge>
        {r.topics.slice(0, 2).map((t) => (
          <Badge key={t}>{topicLabel(t)}</Badge>
        ))}
        <StatusBadge status={r.progress?.status} />
      </div>
    </article>
  );
}

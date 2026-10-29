import type { ReactNode } from 'react';
import { MASTERY_LABEL, type MasteryStatus, type StudentProfile } from '../../../shared/study/types';
import { VERIFICATION_LABEL, type VerificationStatus } from '../../../shared/curriculum/types';
import { Badge } from '../../components/ui';
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
    <Badge tone={STATUS_TONE[status]} title="FlowCompanion learning indicator, based on answers marked in the app. Not an Ontario achievement level or mark.">
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

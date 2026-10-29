import { Download, RefreshCw, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CurriculumUpdateCheck } from '../../../shared/curriculum/views';
import { GRADES } from '../../../shared/study/types';
import { Banner, Button, Loading, Select, useToast } from '../../components/ui';
import { api, errorMessage, onAppEvent } from '../../lib/api';
import { invalidate, useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { VerificationBadge } from './common';
import { SourceLink } from './render';

export default function Coverage() {
  const toast = useToast();
  const c = useQuery('curriculum:coverage', () => api.curriculum.coverage());
  const o = useQuery('curriculum:overview', () => api.curriculum.overview());
  const imports = useQuery('curriculum:imports', () => api.curriculum.imports());
  const revs = useQuery('curriculum:revisions', () => api.curriculum.revisions());
  const pending = useQuery('curriculum:pending', () => api.curriculum.pendingUpdate());
  const [grade, setGrade] = useState<number | ''>('');
  const [onlyOffline, setOnlyOffline] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [check, setCheck] = useState<CurriculumUpdateCheck | null>(null);
  useEffect(() => onAppEvent('curriculum.progress', (e) => setChecking(e.message)), []);
  if (!c.data || !o.data) return <Loading />;
  const rows = c.data.rows.filter((r) => (grade === '' || r.grades.includes(grade)) && (!onlyOffline || r.withLessons > 0));
  const t = c.data.totals;
  const runCheck = async () => {
    setChecking('Contacting the Ministry site…');
    try {
      setCheck(await api.curriculum.checkForUpdates());
      invalidate('curriculum');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setChecking(null);
    }
  };
  const shown = check ?? pending.data ?? null;
  return (
    <div className="page stack-4" style={{ maxWidth: 1100 }}>
      <h1>Curriculum coverage</h1>
      <p>{c.data.statement}</p>
      <div className="grid grid-4">
        <div className="card">
          <div className="small muted">Courses listed</div>
          <strong style={{ fontSize: '1.4rem' }}>{t.courses}</strong>
        </div>
        <div className="card">
          <div className="small muted">Specific expectations</div>
          <strong style={{ fontSize: '1.4rem' }}>{t.specific}</strong>
        </div>
        <div className="card">
          <div className="small muted">With offline lessons and checked practice</div>
          <strong style={{ fontSize: '1.4rem' }}>{t.withLessons}</strong>
        </div>
        <div className="card">
          <div className="small muted">Courses only in Ministry PDFs</div>
          <strong style={{ fontSize: '1.4rem' }}>{t.pdfOnlyCourses}</strong>
        </div>
      </div>

      <section className="card stack-3" aria-label="Curriculum source">
        <h2 className="h2">Source and verification</h2>
        <p className="small">
          Expectations are imported word for word from the Ontario Ministry of Education’s Curriculum and Resources site (<SourceLink url={o.data.source.site} label="dcp.edu.gov.on.ca" />) on {o.data.source.fetchedAt.slice(0, 10)}. {o.data.source.copyright} <SourceLink url={o.data.source.terms} label="Copyright terms" />
        </p>
        <p className="small muted">
          Last check against the live site: {o.data.source.lastCheckedAt ? `${o.data.source.lastCheckedAt.slice(0, 10)} — ${o.data.source.lastCheckResult}` : 'not yet'}.
          {o.data.changedUpstream ? ` ${o.data.changedUpstream} expectations have changed on the Ministry site since they were imported.` : ''}
          {o.data.unverified ? ` ${o.data.unverified} records came from an imported file and are not verified.` : ''}
        </p>
        <div className="row-wrap">
          <Button icon={<RefreshCw size={14} />} loading={!!checking} onClick={() => void runCheck()}>
            Check the Ministry site for changes
          </Button>
          <Button
            icon={<Upload size={14} />}
            onClick={() =>
              void api.curriculum
                .importFile()
                .then((r) => {
                  if (r) {
                    toast(r.summary, 'success');
                    invalidate('curriculum');
                  }
                })
                .catch((e: unknown) => toast(errorMessage(e), 'error'))
            }
          >
            Import a curriculum file (unverified)
          </Button>
          <Button icon={<Download size={14} />} onClick={() => void api.curriculum.exportCoverage().catch((e: unknown) => toast(errorMessage(e), 'error'))}>
            Export coverage report
          </Button>
        </div>
        {checking ? <p className="tiny muted">{checking}</p> : null}
        <p className="tiny faint">Checking downloads public curriculum pages only (about 40 requests to ws.api.dcp.edu.gov.on.ca). No personal information is sent. Nothing changes until you apply the update.</p>
        {shown ? (
          <Banner tone={shown.hasChanges ? 'warn' : 'ok'} title={shown.hasChanges ? 'The Ministry site has changes' : 'Up to date'}>
            {shown.summary} (checked {shown.checkedAt.slice(0, 16).replace('T', ' ')}).
            {shown.changed.slice(0, 5).map((ch) => (
              <div key={ch.id} className="tiny" style={{ marginTop: 4 }}>
                <strong>{ch.id.split(':').pop()}</strong>: “{ch.after.slice(0, 160)}”
              </div>
            ))}
            {shown.hasChanges ? (
              <div style={{ marginTop: 8 }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    void api.curriculum
                      .applyUpdate()
                      .then((r) => {
                        toast(`Updated: ${r.summary}`, 'success');
                        setCheck(null);
                        invalidate('curriculum');
                      })
                      .catch((e: unknown) => toast(errorMessage(e), 'error'))
                  }
                >
                  Apply the update
                </Button>
              </div>
            ) : null}
          </Banner>
        ) : null}
        {imports.data?.length ? (
          <details className="small">
            <summary>Import history ({imports.data.length})</summary>
            <ul>
              {imports.data.map((i) => (
                <li key={i.id}>
                  {i.importedAt.slice(0, 16).replace('T', ' ')} — {i.source === 'bundled' ? 'shipped with the app' : i.source === 'live' ? 'from the Ministry site' : 'from a file (unverified)'}: {i.summary}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {revs.data?.length ? (
          <details className="small">
            <summary>Recent Ministry changes ({revs.data.length})</summary>
            <ul>
              {revs.data.map((r, i) => (
                <li key={i}>
                  {r.at.slice(0, 10)}: {r.recordId} {r.change}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="stack-3" aria-label="Coverage by course">
        <div className="row-wrap">
          <h2 className="h2 grow">By course</h2>
          <Select value={String(grade)} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : '')} aria-label="Grade">
            <option value="">All grades</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </Select>
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={onlyOffline} onChange={(e) => setOnlyOffline(e.target.checked)} /> Only courses with offline lessons
          </label>
        </div>
        <table className="table small">
          <thead>
            <tr>
              <th>Course</th>
              <th>Status</th>
              <th>Specific expectations</th>
              <th>Offline lessons</th>
              <th>Checked practice</th>
              <th>Practice tests</th>
              <th>AI material saved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.courseId}>
                <td>
                  <button type="button" className="link-button" style={{ textAlign: 'left' }} onClick={() => navigate(`/study/course/${encodeURIComponent(r.courseId)}`)}>
                    {r.label}
                  </button>
                </td>
                <td>
                  <VerificationBadge v={r.verification} />
                </td>
                <td>{r.expectationsSource === 'pdf' ? 'In PDF only' : r.specific}</td>
                <td>{r.withLessons ? `${r.withLessons} (${Math.round((100 * r.withLessons) / Math.max(1, r.specific))}%)` : '—'}</td>
                <td>{r.withPractice || '—'}</td>
                <td>{r.withAssessment || '—'}</td>
                <td>{r.withAiOnly || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny faint">“Offline lessons” and “checked practice” are FlowCompanion-written lessons with generated questions whose answers are checked by code. Coverage is computed from the content in the app; nothing here is typed in by hand.</p>
      </section>
    </div>
  );
}

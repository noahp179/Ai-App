import { GraduationCap } from 'lucide-react';
import { api } from '../../lib/api';
import { useQuery } from '../../lib/query';
import { navigate } from '../../lib/router';
import { Widget } from '../home/Home';

export function HomeLearning() {
  const all = useQuery('learning:resources:all', () => api.learning.resources());
  const recs = useQuery('learning:recs', () => api.learning.recommendations());
  const inProgress = all.data?.filter((r) => r.progress?.status === 'in_progress').slice(0, 3) ?? [];
  const byId = new Map(all.data?.map((r) => [r.id, r]));
  const suggestions = inProgress.length ? [] : (recs.data?.items.slice(0, 3) ?? []);
  return (
    <Widget title="Learning" icon={<GraduationCap size={16} />} action={{ label: 'Learning Hub', route: '/learning' }}>
      {inProgress.length ? <div className="tiny faint">Continue where you left off</div> : <div className="tiny faint">{recs.data?.personalized ? 'Suggested for you' : 'Good places to start'}</div>}
      <div className="col" style={{ gap: 2 }}>
        {inProgress.map((r) => (
          <button key={r.id} type="button" className="list-item" style={{ padding: '4px 6px' }} onClick={() => navigate(`/learning/resource/${r.id}`)}>
            <span className="ellipsis grow">{r.title}</span>
            <span className="tiny faint nowrap">{r.publisher}</span>
          </button>
        ))}
        {suggestions.map((s) => {
          const r = byId.get(s.resourceId);
          return r ? (
            <button key={r.id} type="button" className="list-item" style={{ padding: '4px 6px' }} onClick={() => navigate(`/learning/resource/${r.id}`)}>
              <span className="ellipsis grow">{r.title}</span>
              <span className="tiny faint nowrap">{r.publisher}</span>
            </button>
          ) : null;
        })}
      </div>
    </Widget>
  );
}

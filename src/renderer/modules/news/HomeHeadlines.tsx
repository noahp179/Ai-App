import { Newspaper } from 'lucide-react';
import { api } from '../../lib/api';
import { fmtRelative } from '../../lib/format';
import { useQuery } from '../../lib/query';
import { Widget } from '../home/Home';

export function HomeHeadlines() {
  const items = useQuery('news:home', () => api.news.items({ unreadOnly: true, limit: 5 }));
  return (
    <Widget title="Headlines" icon={<Newspaper size={16} />} action={{ label: 'News', route: '/news' }}>
      {items.data?.length === 0 ? <p className="small muted">No unread headlines. Refresh in News.</p> : null}
      <div className="col" style={{ gap: 4 }}>
        {items.data?.map((it) => (
          <button key={it.id} type="button" className="list-item" style={{ padding: '4px 6px', alignItems: 'flex-start' }} onClick={() => void api.app.openExternal(it.url)}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="ellipsis">{it.title}</div>
              <div className="tiny faint">
                {it.sourceName}
                {it.publishedAt ? ` · ${fmtRelative(it.publishedAt)}` : ''}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Widget>
  );
}

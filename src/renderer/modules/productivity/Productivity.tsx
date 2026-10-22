import { Tabs } from '../../components/ui';
import { navigate, useRoute } from '../../lib/router';
import { BookmarksTab } from './BookmarksTab';
import { FocusTab } from './FocusTab';
import { PlannerTab } from './PlannerTab';
import { TasksTab } from './TasksTab';
import { TimeTab } from './TimeTab';
import { ToolsTab } from './ToolsTab';

const TABS = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'focus', label: 'Focus timer' },
  { value: 'time', label: 'Time tracker' },
  { value: 'planner', label: 'Study planner' },
  { value: 'bookmarks', label: 'Bookmarks' },
  { value: 'reading', label: 'Reading queue' },
  { value: 'tools', label: 'Calculator & units' },
] as const;
type Tab = (typeof TABS)[number]['value'];

export default function Productivity() {
  const route = useRoute();
  const tab = (TABS.some((t) => t.value === route.segments[1]) ? route.segments[1] : 'tasks') as Tab;
  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <Tabs label="Productivity tools" value={tab} tabs={[...TABS]} onChange={(v) => navigate(`/productivity/${v}`)} />
      {tab === 'tasks' ? <TasksTab /> : null}
      {tab === 'focus' ? <FocusTab /> : null}
      {tab === 'time' ? <TimeTab /> : null}
      {tab === 'planner' ? <PlannerTab /> : null}
      {tab === 'bookmarks' ? <BookmarksTab reading={false} /> : null}
      {tab === 'reading' ? <BookmarksTab reading /> : null}
      {tab === 'tools' ? <ToolsTab /> : null}
    </div>
  );
}

import { CalendarClock, ChevronDown, ChevronRight, Inbox, ListPlus, Star, Sun, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Task, TaskPriority } from '../../../shared/types';
import { LinksPanel } from '../../components/LinksPanel';
import { Badge, Button, IconButton, Input, Loading, Menu, Select, Textarea, Toggle, useConfirm, usePrompt, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { invalidate, useQuery } from '../../lib/query';
import { useRoute } from '../../lib/router';
import { useSettings } from '../../lib/settings';

const PRIORITY: Record<TaskPriority, { label: string; tone?: 'danger' | 'warn' | 'info' }> = {
  0: { label: 'None' },
  1: { label: 'Low', tone: 'info' },
  2: { label: 'Medium', tone: 'warn' },
  3: { label: 'High', tone: 'danger' },
};

/** <input type="datetime-local"> works in local time; convert to/from ISO. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function TaskRow({ t, siblings }: { t: Task; siblings: Task[] }) {
  const { settings } = useSettings();
  const toast = useToast();
  const route = useRoute();
  const [open, setOpen] = useState(route.params.get('task') === t.id);
  const [newSub, setNewSub] = useState('');
  const run = async (p: Promise<unknown>) => {
    try {
      await p;
      invalidate('tasks');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const overdue = !t.done && t.dueAt && new Date(t.dueAt) < new Date();
  const idx = siblings.findIndex((x) => x.id === t.id);
  const doneSubs = t.subtasks?.filter((s) => s.done).length ?? 0;

  return (
    <div className="card" style={{ padding: '8px 12px' }}>
      <div className="row">
        <input type="checkbox" checked={t.done} aria-label={`Complete ${t.title}`} onChange={(e) => void run(api.tasks.toggle(t.id, e.target.checked))} style={{ width: 16, height: 16 }} />
        <button type="button" className="grow" style={{ border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', padding: 4, color: 'inherit' }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span style={{ textDecoration: t.done ? 'line-through' : undefined, color: t.done ? 'var(--text-faint)' : undefined }}>{t.title}</span>
        </button>
        {t.subtasks && t.subtasks.length > 0 ? <span className="tiny faint">{doneSubs}/{t.subtasks.length}</span> : null}
        {t.priority ? <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge> : null}
        {t.dueAt ? <Badge tone={overdue ? 'danger' : undefined}>{fmtDateTime(t.dueAt, settings)}</Badge> : null}
        <IconButton label={open ? 'Collapse' : 'Expand'} size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </IconButton>
      </div>
      {open ? (
        <div className="stack-3" style={{ padding: '8px 0 4px 28px' }}>
          <Input aria-label="Task title" defaultValue={t.title} onBlur={(e) => e.target.value !== t.title && void run(api.tasks.update(t.id, { title: e.target.value }))} />
          <Textarea aria-label="Task notes" placeholder="Notes" defaultValue={t.notes} rows={2} onBlur={(e) => e.target.value !== t.notes && void run(api.tasks.update(t.id, { notes: e.target.value }))} />
          <div className="row-wrap">
            <label className="small muted row">
              Due
              <input type="datetime-local" className="input" style={{ width: 'auto' }} value={toLocalInput(t.dueAt)} onChange={(e) => void run(api.tasks.update(t.id, { dueAt: fromLocalInput(e.target.value) }))} />
            </label>
            <label className="small muted row">
              Priority
              <Select value={t.priority} onChange={(e) => void run(api.tasks.update(t.id, { priority: Number(e.target.value) as TaskPriority }))} style={{ width: 'auto' }}>
                {([0, 1, 2, 3] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY[p].label}
                  </option>
                ))}
              </Select>
            </label>
            <span className="spacer" />
            <Button size="sm" variant="ghost" disabled={idx <= 0} onClick={() => void run(api.tasks.move(t.id, siblings[idx - 1]!.id, siblings[idx - 2]?.id ?? null))}>
              Move up
            </Button>
            <Button size="sm" variant="ghost" disabled={idx < 0 || idx >= siblings.length - 1} onClick={() => void run(api.tasks.move(t.id, siblings[idx + 2]?.id ?? null, siblings[idx + 1]!.id))}>
              Move down
            </Button>
            <IconButton label="Delete task" onClick={() => void run(api.tasks.delete(t.id))}>
              <Trash2 size={14} />
            </IconButton>
          </div>
          <div className="stack-3">
            <div className="small muted">Checklist</div>
            {t.subtasks?.map((s) => (
              <div key={s.id} className="row">
                <input type="checkbox" checked={s.done} aria-label={`Complete ${s.title}`} onChange={(e) => void run(api.tasks.toggle(s.id, e.target.checked))} />
                <span className="grow" style={{ textDecoration: s.done ? 'line-through' : undefined, color: s.done ? 'var(--text-faint)' : undefined }}>
                  {s.title}
                </span>
                <IconButton label="Remove item" size="sm" onClick={() => void run(api.tasks.delete(s.id))}>
                  <Trash2 size={12} />
                </IconButton>
              </div>
            ))}
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSub.trim()) return;
                void run(api.tasks.create({ title: newSub, parentId: t.id }));
                setNewSub('');
              }}
            >
              <Input placeholder="Add checklist item" aria-label="Add checklist item" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
              <Button size="sm" type="submit">
                Add
              </Button>
            </form>
          </div>
          <LinksPanel type="task" id={t.id} />
        </div>
      ) : null}
    </div>
  );
}

export function TasksTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [sel, setSel] = useState<string>('inbox');
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const lists = useQuery('tasks:lists', () => api.tasks.lists());
  const counts = useQuery('tasks:counts', () => api.tasks.counts());
  const tasks = useQuery(`tasks:list:${sel}:${showDone}`, () => api.tasks.list({ listId: sel, includeDone: showDone }));
  const builtins = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'today', label: 'Today', icon: Sun, count: (counts.data?.dueToday ?? 0) + (counts.data?.overdue ?? 0) },
    { id: 'upcoming', label: 'Upcoming', icon: CalendarClock },
    { id: 'all', label: 'All tasks', icon: Star, count: counts.data?.open },
  ];
  const customList = lists.data?.find((l) => l.id === sel);

  const add = async () => {
    if (!title.trim()) return;
    try {
      await api.tasks.create({ title, listId: ['inbox', 'today', 'upcoming', 'all'].includes(sel) ? null : sel, dueAt: fromLocalInput(due) ?? (sel === 'today' ? new Date(new Date().setHours(17, 0, 0, 0)).toISOString() : null) });
      setTitle('');
      setDue('');
      invalidate('tasks');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
      <nav className="col" aria-label="Task lists" style={{ gap: 2 }}>
        {builtins.map((b) => (
          <button key={b.id} type="button" className={`nav-item ${sel === b.id ? 'active' : ''}`} onClick={() => setSel(b.id)}>
            <b.icon size={15} />
            <span className="grow">{b.label}</span>
            {b.count ? <span className="tiny faint">{b.count}</span> : null}
          </button>
        ))}
        <div className="nav-section">Lists</div>
        {lists.data?.map((l) => (
          <button key={l.id} type="button" className={`nav-item ${sel === l.id ? 'active' : ''}`} onClick={() => setSel(l.id)}>
            <span className="grow ellipsis">{l.name}</span>
            {l.openCount ? <span className="tiny faint">{l.openCount}</span> : null}
          </button>
        ))}
        <button
          type="button"
          className="nav-item"
          onClick={async () => {
            const name = await prompt({ title: 'New list', label: 'List name', confirmLabel: 'Create' });
            if (!name) return;
            const l = await api.tasks.createList(name);
            invalidate('tasks');
            setSel(l.id);
          }}
        >
          <ListPlus size={15} /> New list
        </button>
      </nav>
      <div className="stack-4">
        <div className="row">
          <h2 className="grow">{customList?.name ?? builtins.find((b) => b.id === sel)?.label}</h2>
          <Toggle checked={showDone} onChange={setShowDone} label="Show completed" />
          {customList ? (
            <Menu
              label="List actions"
              icon={<ChevronDown size={16} />}
              items={[
                { label: 'Rename list', onSelect: async () => { const n = await prompt({ title: 'Rename list', label: 'List name', initial: customList.name }); if (n) { await api.tasks.renameList(customList.id, n); invalidate('tasks'); } } },
                { label: 'Clear completed', onSelect: () => void api.tasks.clearCompleted(customList.id).then(() => invalidate('tasks')) },
                {
                  label: 'Delete list and its tasks',
                  danger: true,
                  onSelect: async () => {
                    if (await confirm({ title: `Delete “${customList.name}”?`, message: 'The list and all its tasks are deleted.', confirmLabel: 'Delete', danger: true })) {
                      await api.tasks.deleteList(customList.id);
                      setSel('inbox');
                      invalidate('tasks');
                    }
                  },
                },
              ]}
            />
          ) : sel === 'inbox' ? (
            <Button size="sm" variant="ghost" onClick={() => void api.tasks.clearCompleted(null).then(() => invalidate('tasks'))}>
              Clear completed
            </Button>
          ) : null}
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input placeholder="Add a task…" aria-label="New task" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="datetime-local" className="input" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} style={{ width: 210 }} />
          <Button type="submit" variant="primary" disabled={!title.trim()}>
            Add
          </Button>
        </form>
        {tasks.loading && !tasks.data ? <Loading /> : null}
        {tasks.data?.length === 0 ? <div className="empty"><h3>Nothing here</h3><p>{sel === 'today' ? 'No tasks due today.' : 'Add a task above.'}</p></div> : null}
        <div className="stack-3">
          {tasks.data?.map((t) => (
            <TaskRow key={t.id} t={t} siblings={tasks.data!.filter((x) => !x.done)} />
          ))}
        </div>
      </div>
    </div>
  );
}

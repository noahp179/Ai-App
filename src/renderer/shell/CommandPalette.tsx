import { BookMarked, Bookmark, CalendarDays, CornerDownLeft, FileText, GraduationCap, ListTodo, MessageSquare, Newspaper, NotebookPen, Sparkles, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SearchHit } from '../../shared/types';
import { routeFor } from '../components/LinksPanel';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useSettings } from '../lib/settings';
import { MODULES } from '../modules/registry';

interface Item {
  id: string;
  label: string;
  hint?: ReactNode;
  icon: ReactNode;
  run: () => void;
}

const HIT_ICON: Record<SearchHit['type'], ReactNode> = {
  note: <NotebookPen size={15} />,
  task: <ListTodo size={15} />,
  prompt: <BookMarked size={15} />,
  conversation: <MessageSquare size={15} />,
  event: <CalendarDays size={15} />,
  bookmark: <Bookmark size={15} />,
  resource: <GraduationCap size={15} />,
  article: <Newspaper size={15} />,
};

/** Renders FTS snippets: highlight markers become <mark>, never HTML. */
export function Snippet({ text }: { text: string }) {
  // eslint-disable-next-line no-control-regex -- the search index marks highlights with STX/ETX
  const parts = text.split(/(\u0002[^\u0003]*\u0003)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('\u0002') ? (
          <mark key={i} style={{ background: 'var(--accent-bg)', color: 'var(--text)', borderRadius: 3 }}>
            {p.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function CommandPalette({ onClose, onCapture }: { onClose: () => void; onCapture: () => void }) {
  const { settings, update } = useSettings();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      api.search
        .query(q)
        .then(setHits)
        .catch(() => setHits([]));
    }, 120);
    return () => clearTimeout(t);
  }, [q]);

  const commands = useMemo<Item[]>(() => {
    const go = (r: string) => () => navigate(r);
    const base: Item[] = [
      { id: 'capture', label: 'Quick capture', hint: 'note, task or link', icon: <Zap size={15} />, run: onCapture },
      { id: 'new-note', label: 'New note', icon: <NotebookPen size={15} />, run: go('/notes/new') },
      { id: 'new-chat', label: 'New AI chat', icon: <Sparkles size={15} />, run: go('/ai/new') },
      { id: 'focus', label: 'Start focus session', icon: <ListTodo size={15} />, run: go('/productivity/focus?start=1') },
      { id: 'reminders', label: 'Reminders', icon: <CalendarDays size={15} />, run: go('/calendar/reminders') },
      { id: 'inbox', label: 'Notifications', icon: <FileText size={15} />, run: go('/inbox') },
      {
        id: 'theme',
        label: `Switch to ${settings.appearance.theme === 'dark' ? 'light' : 'dark'} theme`,
        icon: <Sparkles size={15} />,
        run: () => void update({ appearance: { theme: settings.appearance.theme === 'dark' ? 'light' : 'dark' } }),
      },
      { id: 'df', label: settings.layout.distractionFree ? 'Leave distraction-free mode' : 'Distraction-free mode', hint: 'Ctrl+Shift+D', icon: <Zap size={15} />, run: () => void update({ layout: { distractionFree: !settings.layout.distractionFree } }) },
      { id: 'companion', label: 'Show or hide companion', icon: <Zap size={15} />, run: () => void api.window.toggleCompanion() },
    ];
    const modules = MODULES.filter((m) => settings.layout.modules[m.id]).map<Item>((m) => {
      const Icon = m.icon;
      return { id: `go-${m.id}`, label: `Go to ${m.label}`, hint: m.description, icon: <Icon size={15} />, run: go(`/${m.id}`) };
    });
    return [...base, ...modules];
  }, [settings, update, onCapture]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cmds = needle ? commands.filter((c) => c.label.toLowerCase().includes(needle)) : commands.slice(0, 9);
    const hitItems: Item[] = hits.map((h) => ({
      id: `${h.type}:${h.id}`,
      label: h.title,
      hint: <Snippet text={h.snippet} />,
      icon: HIT_ICON[h.type],
      run: () => navigate(routeFor(h.type, h.id)),
    }));
    return [...cmds.slice(0, 6), ...hitItems];
  }, [q, commands, hits]);

  useEffect(() => setSel(0), [q, hits]);

  const choose = (i: number) => {
    const it = filtered[i];
    if (!it) return;
    onClose();
    it.run();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Search and commands">
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            className="input"
            style={{ height: 40, fontSize: '1rem' }}
            placeholder="Search notes, tasks, chats, prompts, events… or type a command"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
            aria-controls="palette-results"
            aria-activedescendant={filtered[sel] ? `pal-${sel}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(sel);
              } else if (e.key === 'Escape') onClose();
            }}
          />
        </div>
        <div className="palette-results" id="palette-results" role="listbox" style={{ padding: 6 }}>
          {filtered.length === 0 ? <div className="small muted" style={{ padding: 12 }}>No results.</div> : null}
          {filtered.map((it, i) => (
            <div
              key={it.id}
              id={`pal-${i}`}
              role="option"
              aria-selected={i === sel}
              className="palette-item"
              onMouseEnter={() => setSel(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
            >
              <span style={{ marginTop: 2, color: 'var(--text-muted)' }}>{it.icon}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis">{it.label}</div>
                {it.hint ? <div className="small faint ellipsis">{it.hint}</div> : null}
              </div>
              {i === sel ? <CornerDownLeft size={14} className="faint" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

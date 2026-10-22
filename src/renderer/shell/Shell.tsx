import { Bell, ChevronLeft, ChevronRight, PictureInPicture2, Plus, Search, Shield } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { IconButton, Loading } from '../components/ui';
import { api, onAppEvent } from '../lib/api';
import { navigate, useRoute } from '../lib/router';
import { useSettings } from '../lib/settings';
import { useParental } from '../lib/parental';
import { MODULES, SECTION_LABELS, moduleForPath, type ModuleDef } from '../modules/registry';
import { CommandPalette } from './CommandPalette';
import { InboxPage } from './InboxPage';
import { QuickCapture } from './QuickCapture';
import { SessionBanner } from './SessionBanner';

function useUnread(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const load = () => void api.inbox.unreadCount().then(setN).catch(() => {});
    load();
    const off1 = onAppEvent('notification', load);
    const off2 = onAppEvent('data.changed', ({ entity }) => entity === 'inbox' && load());
    window.addEventListener('fc:inbox-read', load);
    return () => {
      off1();
      off2();
      window.removeEventListener('fc:inbox-read', load);
    };
  }, []);
  return n;
}

export function Shell() {
  const { settings, update } = useSettings();
  const route = useRoute();
  const parental = useParental();
  const unread = useUnread();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  const enabled = useMemo(() => MODULES.filter((m) => settings.layout.modules[m.id]), [settings.layout.modules]);
  const active = moduleForPath(route.path);
  const sessionActive = !!parental?.session && !parental.session.endedAt;
  const isAllowed = (m: ModuleDef) => parental?.isModuleAllowed(m.id) ?? true;

  useEffect(() => {
    void api.app.setLastRoute(route.path).catch(() => {});
  }, [route.path]);

  useEffect(() => {
    if (route.path === '/capture') {
      setCaptureOpen(true);
      navigate('/home', { replace: true });
    }
  }, [route.path]);

  useEffect(() => onAppEvent('quickCapture.open', () => setCaptureOpen(true)), []);
  useEffect(() => onAppEvent('navigate', ({ route: r }) => navigate(r)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (mod && e.key === '\\') {
        e.preventDefault();
        void update({ layout: { sidebarCollapsed: !settings.layout.sidebarCollapsed } });
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        void update({ layout: { distractionFree: !settings.layout.distractionFree } });
      } else if (e.key === 'Escape' && settings.layout.distractionFree && !document.querySelector('.modal')) {
        void update({ layout: { distractionFree: false } });
      } else if (mod && /^[1-9]$/.test(e.key) && !e.shiftKey && !e.altKey) {
        const m = enabled[Number(e.key) - 1];
        if (m) {
          e.preventDefault();
          navigate(`/${m.id}`);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, settings.layout, update]);

  let content: ReactNode;
  if (route.path === '/inbox') content = <InboxPage />;
  else if (!active) content = <NotFound />;
  else if (!settings.layout.modules[active.id]) content = <ModuleOff module={active} />;
  else if (!isAllowed(active)) content = <ModuleLocked module={active} />;
  else {
    const C = active.component;
    content = <C />;
  }

  const sections = (['workspace', 'create', 'discover', 'system'] as const).map((sec) => ({
    sec,
    items: enabled.filter((m) => m.section === sec),
  }));

  return (
    <div className={`shell ${settings.layout.sidebarCollapsed ? 'collapsed' : ''} ${settings.layout.distractionFree ? 'distraction-free' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden>
            F
          </div>
          <span>FlowCompanion</span>
        </div>
        <nav>
          {sections.map(({ sec, items }) =>
            items.length === 0 ? null : (
              <div key={sec}>
                <div className="nav-section">{SECTION_LABELS[sec]}</div>
                {items.map((m) => {
                  const Icon = m.icon;
                  const locked = !isAllowed(m);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`nav-item ${active?.id === m.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                      aria-current={active?.id === m.id ? 'page' : undefined}
                      title={locked ? `${m.label} is not part of this study session` : m.label}
                      onClick={() => navigate(`/${m.id}`)}
                    >
                      <Icon size={17} aria-hidden />
                      <span className="nav-label">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            ),
          )}
        </nav>
        <div className="sidebar-footer">
          {settings.companion.enabled ? (
            <button type="button" className="nav-item" onClick={() => void api.window.toggleCompanion()} title="Show or hide the floating companion">
              <PictureInPicture2 size={17} aria-hidden />
              <span className="nav-label">Companion</span>
            </button>
          ) : null}
          <button
            type="button"
            className="nav-item"
            onClick={() => void update({ layout: { sidebarCollapsed: !settings.layout.sidebarCollapsed } })}
            title={settings.layout.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {settings.layout.sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            <span className="nav-label">Collapse</span>
          </button>
        </div>
      </aside>

      <div className="main">
        {parental?.enabled ? (
          <div className="banner-strip parental" role="status">
            <Shield size={15} aria-hidden />
            <span>
              Parental learning controls are on
              {parental.config.copyRestriction ? ' · copying limited in the AI workspace' : ''}
              {parental.config.screenCapturePrivacy ? (parental.platform.screenCapturePrivacy.applied ? ' · screen-capture privacy requested' : ' · screen-capture privacy not supported on this OS') : ''}
              {parental.config.tutorMode ? ' · tutor mode' : ''}
            </span>
            <span className="spacer" />
            <button type="button" className="btn ghost sm" onClick={() => navigate('/settings/parental')}>
              Details
            </button>
          </div>
        ) : null}
        {sessionActive ? <SessionBanner /> : null}
        {settings.layout.distractionFree ? null : (
          <header className="topbar">
            <div className="topbar-title">{route.path === '/inbox' ? 'Notifications' : (active?.label ?? 'FlowCompanion')}</div>
            <span className="spacer" />
            <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Search and commands">
              <Search size={15} aria-hidden />
              <span className="grow" style={{ textAlign: 'left' }}>
                Search or jump to…
              </span>
              <kbd>{window.fc.platform === 'darwin' ? '⌘' : 'Ctrl'} K</kbd>
            </button>
            <IconButton label="Quick capture" onClick={() => setCaptureOpen(true)}>
              <Plus size={18} />
            </IconButton>
            <div style={{ position: 'relative' }}>
              <IconButton label={unread ? `Notifications, ${unread} unread` : 'Notifications'} active={route.path === '/inbox'} onClick={() => navigate('/inbox')}>
                <Bell size={18} />
              </IconButton>
              {unread > 0 ? (
                <span className="nav-badge" style={{ position: 'absolute', top: -2, right: -4, pointerEvents: 'none' }} aria-hidden>
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </div>
          </header>
        )}
        <main className="content" id="main-content">
          <ErrorBoundary key={active?.id ?? route.path}>
            <Suspense fallback={<Loading />}>{content}</Suspense>
          </ErrorBoundary>
        </main>
      </div>
      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} onCapture={() => setCaptureOpen(true)} /> : null}
      {captureOpen ? <QuickCapture onClose={() => setCaptureOpen(false)} /> : null}
    </div>
  );
}

function NotFound() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        <button type="button" className="btn" onClick={() => navigate('/home')}>
          Go home
        </button>
      </p>
    </div>
  );
}

function ModuleOff({ module }: { module: ModuleDef }) {
  return (
    <div className="page">
      <div className="empty">
        <h3>{module.label} is turned off</h3>
        <p>You can turn modules on and off in Settings → Modules.</p>
        <button type="button" className="btn primary" onClick={() => navigate('/settings/modules')}>
          Open module settings
        </button>
      </div>
    </div>
  );
}

function ModuleLocked({ module }: { module: ModuleDef }) {
  return (
    <div className="page">
      <div className="empty">
        <Shield size={28} />
        <h3>{module.label} is paused during this study session</h3>
        <p>A parent or guardian set up a supervised study session. The modules included in the session are still available.</p>
      </div>
    </div>
  );
}

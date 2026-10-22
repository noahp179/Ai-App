import { type ComponentType } from 'react';
import { navigate, useRoute } from '../../lib/router';
import {
  AboutSection,
  AccountsSection,
  AiSection,
  AppearanceSection,
  CalendarSection,
  CompanionSection,
  DataSection,
  GeneralSection,
  ModulesSection,
  NotesSection,
  NotificationsSection,
  PrivacySection,
  ProductivitySection,
  ShortcutsSection,
} from './sections';
import { EXTRA_SECTIONS } from './extraSections';

export interface SettingsSectionDef {
  id: string;
  label: string;
  group: 'App' | 'Features' | 'Privacy & data';
  component: ComponentType;
}

const SECTIONS: SettingsSectionDef[] = [
  { id: 'general', label: 'General', group: 'App', component: GeneralSection },
  { id: 'appearance', label: 'Appearance', group: 'App', component: AppearanceSection },
  { id: 'modules', label: 'Modules', group: 'App', component: ModulesSection },
  { id: 'companion', label: 'Floating companion', group: 'App', component: CompanionSection },
  { id: 'shortcuts', label: 'Keyboard shortcuts', group: 'App', component: ShortcutsSection },
  { id: 'notifications', label: 'Notifications', group: 'App', component: NotificationsSection },
  { id: 'ai', label: 'AI providers', group: 'Features', component: AiSection },
  { id: 'notes', label: 'Notes', group: 'Features', component: NotesSection },
  { id: 'productivity', label: 'Productivity', group: 'Features', component: ProductivitySection },
  { id: 'calendar', label: 'Calendar', group: 'Features', component: CalendarSection },
  ...EXTRA_SECTIONS,
  { id: 'privacy', label: 'Privacy', group: 'Privacy & data', component: PrivacySection },
  { id: 'data', label: 'Data and backups', group: 'Privacy & data', component: DataSection },
  { id: 'accounts', label: 'Accounts and sync', group: 'Privacy & data', component: AccountsSection },
  { id: 'about', label: 'About', group: 'Privacy & data', component: AboutSection },
];

export default function SettingsPage() {
  const route = useRoute();
  const active = SECTIONS.find((s) => s.id === route.segments[1]) ?? SECTIONS[0]!;
  const C = active.component;
  const groups = ['App', 'Features', 'Privacy & data'] as const;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: '100%' }}>
      <nav aria-label="Settings sections" style={{ borderRight: '1px solid var(--border)', padding: 12, overflow: 'auto', background: 'var(--bg-sunken)' }}>
        {groups.map((g) => (
          <div key={g}>
            <div className="nav-section">{g}</div>
            {SECTIONS.filter((s) => s.group === g).map((s) => (
              <button key={s.id} type="button" className={`nav-item ${s.id === active.id ? 'active' : ''}`} aria-current={s.id === active.id ? 'page' : undefined} onClick={() => navigate(`/settings/${s.id}`)}>
                {s.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ overflow: 'auto' }}>
        <div className="page stack-4" style={{ maxWidth: 900 }}>
          <h1>{active.label}</h1>
          <C />
        </div>
      </div>
    </div>
  );
}

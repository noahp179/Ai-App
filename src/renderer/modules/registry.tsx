import {
  BookMarked,
  CalendarDays,
  Gamepad2,
  GraduationCap,
  House,
  ListTodo,
  Newspaper,
  NotebookPen,
  Palette,
  School,
  Settings as SettingsIcon,
  Sparkles,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ModuleId } from '../../shared/settings';

export interface ModuleDef {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  section: 'workspace' | 'discover' | 'create' | 'system';
  component: LazyExoticComponent<ComponentType>;
  description: string;
}

/** Modules load lazily so inactive ones cost nothing at startup. */
export const MODULES: ModuleDef[] = [
  { id: 'home', label: 'Home', icon: House, section: 'workspace', component: lazy(() => import('./home/Home')), description: 'Your day at a glance.' },
  { id: 'ai', label: 'AI Workspace', icon: Sparkles, section: 'workspace', component: lazy(() => import('./ai/AiWorkspace')), description: 'Chat with the AI providers you connect.' },
  { id: 'notes', label: 'Notes', icon: NotebookPen, section: 'workspace', component: lazy(() => import('./notes/Notes')), description: 'Local-first notes and knowledge.' },
  { id: 'productivity', label: 'Productivity', icon: ListTodo, section: 'workspace', component: lazy(() => import('./productivity/Productivity')), description: 'Tasks, focus timer, time tracking, bookmarks and tools.' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, section: 'workspace', component: lazy(() => import('./calendar/Calendar')), description: 'Local calendar and reminders.' },
  { id: 'prompts', label: 'Prompt Library', icon: BookMarked, section: 'create', component: lazy(() => import('./prompts/Prompts')), description: 'Your reusable prompts.' },
  { id: 'marketplace', label: 'Marketplace', icon: Store, section: 'create', component: lazy(() => import('./marketplace/Marketplace')), description: 'Discover and share prompts.' },
  { id: 'creator', label: 'Creator Studio', icon: Palette, section: 'create', component: lazy(() => import('./creator/Creator')), description: 'Draft and publish prompt listings.' },
  { id: 'study', label: 'Student Learning', icon: School, section: 'workspace', component: lazy(() => import('./study/Study')), description: 'Ontario Grades 6–12 curriculum, lessons, practice and a study planner.' },
  { id: 'learning', label: 'Learning Hub', icon: GraduationCap, section: 'discover', component: lazy(() => import('./learning/Learning')), description: 'Free, reputable AI learning resources.' },
  { id: 'news', label: 'News', icon: Newspaper, section: 'discover', component: lazy(() => import('./news/News')), description: 'Headlines from sources you choose.' },
  { id: 'games', label: 'Games', icon: Gamepad2, section: 'discover', component: lazy(() => import('./games/Games')), description: 'Short breaks: word, logic and memory games.' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, section: 'system', component: lazy(() => import('./settings/SettingsPage')), description: 'Preferences, privacy and data.' },
];

export const SECTION_LABELS: Record<ModuleDef['section'], string> = {
  workspace: 'Workspace',
  create: 'Create',
  discover: 'Discover',
  system: 'System',
};

export function moduleForPath(path: string): ModuleDef | undefined {
  const first = path.split('/').filter(Boolean)[0] ?? 'home';
  return MODULES.find((m) => m.id === first);
}

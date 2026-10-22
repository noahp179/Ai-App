import { lazy, type ComponentType } from 'react';
import type { ModuleId } from '../../../shared/settings';

const HomeLearning = lazy(() => import('../learning/HomeLearning').then((m) => ({ default: m.HomeLearning })));
const HomeHeadlines = lazy(() => import('../news/HomeHeadlines').then((m) => ({ default: m.HomeHeadlines })));

/** Home-screen widgets contributed by feature modules (news, learning). */
export const HOME_WIDGETS: { id: string; module: ModuleId; component: ComponentType }[] = [
  { id: 'learning', module: 'learning', component: HomeLearning },
  { id: 'headlines', module: 'news', component: HomeHeadlines },
];

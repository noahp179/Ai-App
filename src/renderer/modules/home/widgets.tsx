import { lazy, type ComponentType } from 'react';
import type { ModuleId } from '../../../shared/settings';

const HomeHeadlines = lazy(() => import('../news/HomeHeadlines').then((m) => ({ default: m.HomeHeadlines })));

/** Home-screen widgets contributed by feature modules (news, learning). */
export const HOME_WIDGETS: { id: string; module: ModuleId; component: ComponentType }[] = [{ id: 'headlines', module: 'news', component: HomeHeadlines }];

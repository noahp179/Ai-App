import { LearningSettings } from '../learning/LearningSettings';
import { MarketplaceSettings } from '../marketplace/MarketplaceSettings';
import { NewsSettings } from '../news/NewsSettings';
import type { SettingsSectionDef } from './SettingsPage';

/** Settings sections contributed by feature modules (news, learning, marketplace, browser, parental). */
export const EXTRA_SECTIONS: SettingsSectionDef[] = [
  { id: 'learning', label: 'Learning', group: 'Features', component: LearningSettings },
  { id: 'news', label: 'News', group: 'Features', component: NewsSettings },
  { id: 'marketplace', label: 'Marketplace', group: 'Features', component: MarketplaceSettings },
];

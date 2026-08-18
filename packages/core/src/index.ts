/**
 * @synapse/core — the platform-agnostic heart of the app.
 *
 * Contains no React, no native modules, and no I/O beyond an injected `fetch`.
 * Both the mobile app and the desktop shell import from here, and the entire
 * package runs under plain Node for testing.
 */

// Domain
export * from './domain/types';

// Engine
export * from './engine/grading';
export * from './engine/scheduler';
export * from './engine/progression';
export * from './engine/placement';
export * from './engine/session';

// Content
export * from './content/index';
export { achievementProgress, ACHIEVEMENTS_BY_ID } from './content/achievements';
export type { AchievementStats, AchievementProgress } from './content/achievements';

// Monetization
export * from './monetization/plans';
export * from './monetization/entitlements';

// Store
export * from './store/progress';

// Services
export * from './services/tutor';
export * from './services/analytics';

// Utilities
export * from './util/format';

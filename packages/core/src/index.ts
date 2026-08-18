/**
 * @synapse/core — the platform-agnostic heart of the app.
 *
 * Contains no React, no native modules, and no I/O beyond an injected `fetch`.
 * Both the mobile app and the desktop shell import from here, and the entire
 * package runs under plain Node for testing.
 */

// Domain
export * from './domain/types.js';

// Engine
export * from './engine/grading.js';
export * from './engine/scheduler.js';
export * from './engine/progression.js';
export * from './engine/placement.js';
export * from './engine/session.js';

// Content
export * from './content/index.js';
export { achievementProgress, ACHIEVEMENTS_BY_ID } from './content/achievements.js';
export type { AchievementStats, AchievementProgress } from './content/achievements.js';

// Monetization
export * from './monetization/plans.js';
export * from './monetization/entitlements.js';

// Store
export * from './store/progress.js';

// Services
export * from './services/tutor.js';
export * from './services/analytics.js';

// Utilities
export * from './util/format.js';

/**
 * Analytics.
 *
 * A typed event union rather than free-form strings, so a renamed event breaks
 * the build instead of silently breaking a funnel. The transport is injected,
 * which keeps this module testable and makes the "no analytics" case a real
 * supported configuration rather than an afterthought.
 *
 * Privacy stance, enforced here rather than left to policy: no event carries
 * free text the learner typed, no email address, and no content of their
 * answers. Events carry ids and outcomes.
 */

export type AnalyticsEvent =
  // Onboarding
  | { name: 'onboarding_started' }
  | { name: 'onboarding_goal_selected'; goals: string[] }
  | { name: 'onboarding_completed'; dailyMinutes: number; selfReportedLevel: string }
  | { name: 'placement_started' }
  | { name: 'placement_completed'; level: string; correct: number; total: number }
  | { name: 'placement_skipped' }
  // Learning
  | { name: 'lesson_started'; lessonId: string; trackId: string; level: string }
  | {
      name: 'lesson_completed';
      lessonId: string;
      trackId: string;
      accuracy: number;
      xp: number;
      durationMs: number;
    }
  | { name: 'lesson_abandoned'; lessonId: string; stepIndex: number; totalSteps: number }
  | { name: 'exercise_answered'; exerciseId: string; kind: string; correct: boolean; usedHint: boolean }
  | { name: 'checkpoint_completed'; checkpointId: string; score: number; passed: boolean }
  | { name: 'review_session_completed'; itemCount: number; accuracy: number }
  // Engagement
  | { name: 'streak_extended'; days: number }
  | { name: 'streak_lost'; previousDays: number }
  | { name: 'streak_freeze_used'; remaining: number }
  | { name: 'daily_goal_met'; targetXp: number }
  | { name: 'achievement_unlocked'; achievementId: string; tier: number }
  | { name: 'level_up'; level: number }
  // Hearts & limits
  | { name: 'hearts_depleted'; lessonId: string }
  | { name: 'hearts_refilled'; method: 'gems' | 'purchase' | 'ad' | 'wait' | 'upgrade' }
  | { name: 'tutor_limit_reached'; plan: string }
  // Monetization
  | { name: 'paywall_shown'; trigger: PaywallTrigger; plan: string }
  | { name: 'paywall_dismissed'; trigger: PaywallTrigger }
  | { name: 'plan_selected'; planId: string; period: string }
  | { name: 'trial_started'; planId: string; trialDays: number }
  | { name: 'purchase_completed'; productId: string; priceUsd: number }
  | { name: 'purchase_failed'; productId: string; reason: string }
  | { name: 'subscription_cancelled'; planId: string; daysActive: number }
  | { name: 'restore_purchases'; found: boolean }
  // Tutor & playground
  | { name: 'tutor_asked'; intent: string; offline: boolean }
  | { name: 'playground_run'; widget: string }
  // App
  | { name: 'app_opened'; platform: string; daysSinceInstall: number }
  | { name: 'notification_opened'; kind: string }
  | { name: 'offline_download_started'; trackId: string }
  | { name: 'error_shown'; code: string };

/**
 * Where a paywall was raised. Reported on every paywall event because
 * conversion differs enormously by trigger, and knowing which surfaces convert
 * is the difference between tuning the product and guessing at it.
 */
export type PaywallTrigger =
  | 'locked-lesson'
  | 'hearts-depleted'
  | 'tutor-limit'
  | 'offline-download'
  | 'certificate'
  | 'interview-prep'
  | 'settings'
  | 'onboarding'
  | 'streak-repair'
  | 'trial-expired';

export interface AnalyticsTransport {
  send(event: AnalyticsEvent, properties: Record<string, unknown>): void;
  flush?(): Promise<void>;
}

/** Discards everything. The default, and what tests and opted-out users get. */
export const nullTransport: AnalyticsTransport = { send: () => {} };

/** Prints events. Useful in development; never wired up in release builds. */
export const consoleTransport: AnalyticsTransport = {
  send: (event, properties) => {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event.name}`, { ...event, ...properties });
  },
};

export interface AnalyticsOptions {
  transport: AnalyticsTransport;
  /** Merged into every event. Keep to non-identifying context. */
  superProperties?: Record<string, unknown>;
  /** When false, nothing is sent. Wired to the learner's privacy setting. */
  enabled?: boolean;
}

export class Analytics {
  private enabled: boolean;
  private superProperties: Record<string, unknown>;

  constructor(private readonly options: AnalyticsOptions) {
    this.enabled = options.enabled ?? true;
    this.superProperties = options.superProperties ?? {};
  }

  track(event: AnalyticsEvent): void {
    if (!this.enabled) return;
    this.options.transport.send(event, this.superProperties);
  }

  /** Honours a privacy-settings toggle. Off means nothing leaves the device. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setSuperProperties(properties: Record<string, unknown>): void {
    this.superProperties = { ...this.superProperties, ...properties };
  }

  async flush(): Promise<void> {
    await this.options.transport.flush?.();
  }
}

/**
 * The funnel steps we actually watch. Documented here so the ordering is
 * explicit and dashboards can be rebuilt from source.
 */
export const ACTIVATION_FUNNEL: Array<AnalyticsEvent['name']> = [
  'app_opened',
  'onboarding_started',
  'onboarding_completed',
  'lesson_started',
  'lesson_completed',
  'daily_goal_met',
  'streak_extended',
];

export const MONETIZATION_FUNNEL: Array<AnalyticsEvent['name']> = [
  'paywall_shown',
  'plan_selected',
  'trial_started',
  'purchase_completed',
];

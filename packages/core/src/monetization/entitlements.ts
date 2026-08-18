/**
 * Entitlements — what a learner is allowed to do.
 *
 * Every gate in the app funnels through this module, so the paywall rules are
 * in one auditable place rather than scattered across screens. Two principles:
 *
 *  1. **Never trap a learner mid-lesson.** A started lesson always finishes.
 *  2. **Free tier is genuinely useful.** The whole Foundations track plus the
 *     first unit of everything else is free forever — enough to actually learn
 *     something, which is also what makes the upgrade credible.
 *
 * The client copy of an entitlement is a cache for UI responsiveness. The
 * server re-validates the receipt before serving paid content; a tampered local
 * state gets you a nicer-looking button, not free content.
 */

import type { Lesson, TrackId } from '../domain/types';
import type { PlanId } from './plans';

export interface Entitlement {
  plan: PlanId;
  /** Epoch ms. `null` for the free plan or a lifetime purchase. */
  expiresAt: number | null;
  /** True while inside the introductory free trial. */
  inTrial: boolean;
  /** Tracks bought individually, outside any subscription. */
  ownedTrackIds: TrackId[];
  /** Set when the store reports a billing problem; unlocks a grace period. */
  billingIssue?: boolean;
}

export const FREE_ENTITLEMENT: Entitlement = {
  plan: 'free',
  expiresAt: null,
  inTrial: false,
  ownedTrackIds: [],
};

/** Tracks that are entirely free, forever. */
export const FREE_TRACK_IDS: TrackId[] = ['track-foundations'];

/** Days of full access after a billing failure, before downgrading. */
const BILLING_GRACE_DAYS = 7;

const PAID_PLANS: ReadonlySet<PlanId> = new Set<PlanId>(['plus', 'pro', 'teams', 'edu']);

/** Whether a paid plan is currently in force, including the billing grace period. */
export function isSubscriptionActive(e: Entitlement, now: number = Date.now()): boolean {
  if (!PAID_PLANS.has(e.plan)) return false;
  if (e.expiresAt === null) return true;
  const graceMs = e.billingIssue ? BILLING_GRACE_DAYS * 86_400_000 : 0;
  return now <= e.expiresAt + graceMs;
}

/** Plans that include everything Plus does. */
function hasPlusTier(e: Entitlement, now: number): boolean {
  return isSubscriptionActive(e, now);
}

/** Plans that include the Pro-only extras. */
function hasProTier(e: Entitlement, now: number): boolean {
  return isSubscriptionActive(e, now) && (e.plan === 'pro' || e.plan === 'teams' || e.plan === 'edu');
}

// ---------------------------------------------------------------------------
// Feature gates
// ---------------------------------------------------------------------------

export interface Limits {
  /** `null` means unlimited. */
  heartsPerSession: number | null;
  aiTutorQuestionsPerDay: number | null;
  streakFreezes: number;
  offlineDownloads: boolean;
  certificates: boolean;
  interviewPrep: boolean;
  playgroundRequestsPerDay: number;
  /** Ads are shown only on the free plan, and never inside a lesson. */
  showsAds: boolean;
}

export function limitsFor(e: Entitlement, now: number = Date.now()): Limits {
  if (hasProTier(e, now)) {
    return {
      heartsPerSession: null,
      aiTutorQuestionsPerDay: null,
      streakFreezes: 5,
      offlineDownloads: true,
      certificates: true,
      interviewPrep: true,
      playgroundRequestsPerDay: 500,
      showsAds: false,
    };
  }
  if (hasPlusTier(e, now)) {
    return {
      heartsPerSession: null,
      aiTutorQuestionsPerDay: null,
      streakFreezes: 3,
      offlineDownloads: true,
      certificates: false,
      interviewPrep: false,
      playgroundRequestsPerDay: 100,
      showsAds: false,
    };
  }
  return {
    heartsPerSession: 5,
    aiTutorQuestionsPerDay: 3,
    streakFreezes: 1,
    offlineDownloads: false,
    certificates: false,
    interviewPrep: false,
    playgroundRequestsPerDay: 10,
    showsAds: true,
  };
}

// ---------------------------------------------------------------------------
// Content access
// ---------------------------------------------------------------------------

export type AccessDenialReason = 'needs-subscription' | 'needs-pro';

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: AccessDenialReason; upsellPlan: PlanId };

/**
 * Whether a learner can open a given lesson.
 *
 * `unitIndex` is the lesson's unit position within its track — the free tier
 * includes unit 0 of every track, which is the sample that sells the rest.
 */
export function canAccessLesson(
  e: Entitlement,
  lesson: Lesson,
  trackId: TrackId,
  unitIndex: number,
  now: number = Date.now(),
): AccessDecision {
  if (lesson.free) return { allowed: true };
  if (FREE_TRACK_IDS.includes(trackId)) return { allowed: true };
  if (unitIndex === 0) return { allowed: true };
  if (e.ownedTrackIds.includes(trackId)) return { allowed: true };
  if (hasPlusTier(e, now)) return { allowed: true };
  return { allowed: false, reason: 'needs-subscription', upsellPlan: 'plus' };
}

export function canAccessCertificates(e: Entitlement, now: number = Date.now()): AccessDecision {
  return hasProTier(e, now)
    ? { allowed: true }
    : { allowed: false, reason: 'needs-pro', upsellPlan: 'pro' };
}

export function canAccessInterviewPrep(e: Entitlement, now: number = Date.now()): AccessDecision {
  return hasProTier(e, now)
    ? { allowed: true }
    : { allowed: false, reason: 'needs-pro', upsellPlan: 'pro' };
}

// ---------------------------------------------------------------------------
// Metered usage
// ---------------------------------------------------------------------------

export interface MeterState {
  /** Local day key the counts belong to. */
  day: string;
  aiTutorQuestions: number;
  playgroundRequests: number;
}

export function newMeter(day: string): MeterState {
  return { day, aiTutorQuestions: 0, playgroundRequests: 0 };
}

/** Rolls the meter over at the day boundary. */
export function rollMeter(meter: MeterState, today: string): MeterState {
  return meter.day === today ? meter : newMeter(today);
}

export interface MeterCheck {
  allowed: boolean;
  remaining: number | null;
  limit: number | null;
}

export function checkAiTutor(
  e: Entitlement,
  meter: MeterState,
  now: number = Date.now(),
): MeterCheck {
  const limit = limitsFor(e, now).aiTutorQuestionsPerDay;
  if (limit === null) return { allowed: true, remaining: null, limit: null };
  const remaining = Math.max(0, limit - meter.aiTutorQuestions);
  return { allowed: remaining > 0, remaining, limit };
}

export function checkPlayground(
  e: Entitlement,
  meter: MeterState,
  now: number = Date.now(),
): MeterCheck {
  const limit = limitsFor(e, now).playgroundRequestsPerDay;
  const remaining = Math.max(0, limit - meter.playgroundRequests);
  return { allowed: remaining > 0, remaining, limit };
}

// ---------------------------------------------------------------------------
// Hearts
// ---------------------------------------------------------------------------

export interface HeartState {
  current: number;
  max: number;
  /** Epoch ms when the next heart regenerates. `null` when full or unlimited. */
  nextRefillAt: number | null;
}

export const HEART_REFILL_MS = 30 * 60_000;

export function newHearts(max = 5): HeartState {
  return { current: max, max, nextRefillAt: null };
}

/**
 * Regenerates hearts based on elapsed time. Called whenever the app resumes,
 * so hearts recover in the background without a timer.
 */
export function regenerateHearts(
  state: HeartState,
  e: Entitlement,
  now: number = Date.now(),
): HeartState {
  if (limitsFor(e, now).heartsPerSession === null) {
    return { current: state.max, max: state.max, nextRefillAt: null };
  }
  if (state.current >= state.max || state.nextRefillAt === null) return state;
  if (now < state.nextRefillAt) return state;

  const elapsed = now - state.nextRefillAt;
  const gained = 1 + Math.floor(elapsed / HEART_REFILL_MS);
  const current = Math.min(state.max, state.current + gained);

  return {
    ...state,
    current,
    nextRefillAt: current >= state.max ? null : state.nextRefillAt + gained * HEART_REFILL_MS,
  };
}

export function spendHeart(state: HeartState, now: number = Date.now()): HeartState {
  if (state.current <= 0) return state;
  const current = state.current - 1;
  return {
    ...state,
    current,
    nextRefillAt: state.nextRefillAt ?? now + HEART_REFILL_MS,
  };
}

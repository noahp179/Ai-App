import { describe, expect, it } from 'vitest';

import {
  CONSUMABLES,
  PLANS,
  annualSavingsPercent,
  monthlyEquivalent,
} from '../src/monetization/plans';
import {
  FREE_ENTITLEMENT,
  FREE_TRACK_IDS,
  HEART_REFILL_MS,
  canAccessCertificates,
  canAccessInterviewPrep,
  canAccessLesson,
  checkAiTutor,
  checkPlayground,
  isSubscriptionActive,
  limitsFor,
  newHearts,
  newMeter,
  regenerateHearts,
  rollMeter,
  spendHeart,
  type Entitlement,
} from '../src/monetization/entitlements';
import { TRACKS_BY_ID } from '../src/content/index';
import type { Lesson } from '../src/domain/types';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

const paidLesson: Lesson = {
  id: 'l1',
  title: 't',
  summary: 's',
  level: 'intermediate',
  domain: 'llms',
  estimatedMinutes: 5,
  steps: [],
};

const plus = (overrides: Partial<Entitlement> = {}): Entitlement => ({
  plan: 'plus',
  expiresAt: NOW + 30 * DAY,
  inTrial: false,
  ownedTrackIds: [],
  ...overrides,
});

describe('plans', () => {
  it('prices annual below twelve months of monthly', () => {
    for (const plan of Object.values(PLANS)) {
      const savings = annualSavingsPercent(plan);
      if (savings === null) continue;
      expect(savings).toBeGreaterThan(0);
      expect(savings).toBeLessThan(80);
    }
  });

  it('computes a monthly equivalent for annual plans', () => {
    expect(monthlyEquivalent(PLANS.plus)).toBeCloseTo(7.5, 1);
    expect(monthlyEquivalent(PLANS.free)).toBeNull();
    expect(annualSavingsPercent(PLANS.free)).toBeNull();
  });

  it('gives every paid plan a store product id and a trial', () => {
    for (const id of ['plus', 'pro', 'teams', 'edu'] as const) {
      const plan = PLANS[id];
      expect(Object.keys(plan.productIds).length).toBeGreaterThan(0);
      expect(plan.trialDays).toBeGreaterThan(0);
      expect(plan.highlights.length).toBeGreaterThan(2);
    }
    expect(PLANS.free.trialDays).toBe(0);
  });

  it('gives every consumable a unique product id', () => {
    const ids = CONSUMABLES.map((c) => c.productId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('subscription status', () => {
  it('treats the free plan as inactive', () => {
    expect(isSubscriptionActive(FREE_ENTITLEMENT, NOW)).toBe(false);
  });

  it('honours an unexpired subscription and rejects an expired one', () => {
    expect(isSubscriptionActive(plus(), NOW)).toBe(true);
    expect(isSubscriptionActive(plus({ expiresAt: NOW - DAY }), NOW)).toBe(false);
  });

  it('extends access through the billing grace period', () => {
    const lapsed = plus({ expiresAt: NOW - 3 * DAY, billingIssue: true });
    expect(isSubscriptionActive(lapsed, NOW)).toBe(true);

    const tooLate = plus({ expiresAt: NOW - 10 * DAY, billingIssue: true });
    expect(isSubscriptionActive(tooLate, NOW)).toBe(false);
  });

  it('treats a null expiry as lifetime access', () => {
    expect(isSubscriptionActive(plus({ expiresAt: null }), NOW)).toBe(true);
  });
});

describe('limits', () => {
  it('gives free users hearts, ads, and a metered tutor', () => {
    const limits = limitsFor(FREE_ENTITLEMENT, NOW);
    expect(limits.heartsPerSession).toBe(5);
    expect(limits.aiTutorQuestionsPerDay).toBe(3);
    expect(limits.showsAds).toBe(true);
    expect(limits.offlineDownloads).toBe(false);
  });

  it('removes hearts, ads, and tutor limits on Plus', () => {
    const limits = limitsFor(plus(), NOW);
    expect(limits.heartsPerSession).toBeNull();
    expect(limits.aiTutorQuestionsPerDay).toBeNull();
    expect(limits.showsAds).toBe(false);
    expect(limits.certificates).toBe(false);
  });

  it('adds certificates and interview prep on Pro', () => {
    const limits = limitsFor(plus({ plan: 'pro' }), NOW);
    expect(limits.certificates).toBe(true);
    expect(limits.interviewPrep).toBe(true);
    expect(limits.playgroundRequestsPerDay).toBeGreaterThan(100);
  });

  it('falls back to free limits once a subscription expires', () => {
    expect(limitsFor(plus({ expiresAt: NOW - DAY }), NOW).heartsPerSession).toBe(5);
  });
});

describe('content access', () => {
  it('keeps the whole foundations track free', () => {
    const track = TRACKS_BY_ID.get(FREE_TRACK_IDS[0]!)!;
    const lastUnitIndex = track.units.length - 1;
    const lastLesson = track.units[lastUnitIndex]!.lessons[0]!;

    expect(
      canAccessLesson(FREE_ENTITLEMENT, lastLesson, track.id, lastUnitIndex, NOW).allowed,
    ).toBe(true);
  });

  it('gives free users the first unit of every track', () => {
    for (const track of TRACKS_BY_ID.values()) {
      const lesson = track.units[0]!.lessons[0]!;
      expect(canAccessLesson(FREE_ENTITLEMENT, lesson, track.id, 0, NOW).allowed, track.id).toBe(true);
    }
  });

  it('locks later units for free users and names the upsell', () => {
    const decision = canAccessLesson(FREE_ENTITLEMENT, paidLesson, 'track-llms', 2, NOW);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('needs-subscription');
      expect(decision.upsellPlan).toBe('plus');
    }
  });

  it('unlocks everything for Plus', () => {
    expect(canAccessLesson(plus(), paidLesson, 'track-llms', 2, NOW).allowed).toBe(true);
  });

  it('honours an individually purchased track without a subscription', () => {
    const owner: Entitlement = { ...FREE_ENTITLEMENT, ownedTrackIds: ['track-llms'] };
    expect(canAccessLesson(owner, paidLesson, 'track-llms', 2, NOW).allowed).toBe(true);
    expect(canAccessLesson(owner, paidLesson, 'track-agents', 2, NOW).allowed).toBe(false);
  });

  it('honours a lesson explicitly marked free', () => {
    const free = { ...paidLesson, free: true };
    expect(canAccessLesson(FREE_ENTITLEMENT, free, 'track-llms', 3, NOW).allowed).toBe(true);
  });

  it('gates certificates and interview prep behind Pro', () => {
    expect(canAccessCertificates(plus(), NOW).allowed).toBe(false);
    expect(canAccessCertificates(plus({ plan: 'pro' }), NOW).allowed).toBe(true);
    expect(canAccessInterviewPrep(plus(), NOW).allowed).toBe(false);
    expect(canAccessInterviewPrep(plus({ plan: 'teams' }), NOW).allowed).toBe(true);
  });
});

describe('metered usage', () => {
  it('counts down the free tutor allowance and then blocks', () => {
    const meter = { ...newMeter('2026-03-01'), aiTutorQuestions: 2 };
    const check = checkAiTutor(FREE_ENTITLEMENT, meter, NOW);
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(1);

    const spent = { ...meter, aiTutorQuestions: 3 };
    expect(checkAiTutor(FREE_ENTITLEMENT, spent, NOW).allowed).toBe(false);
  });

  it('reports unlimited for Plus', () => {
    const meter = { ...newMeter('2026-03-01'), aiTutorQuestions: 900 };
    const check = checkAiTutor(plus(), meter, NOW);
    expect(check.allowed).toBe(true);
    expect(check.limit).toBeNull();
  });

  it('still caps the playground on Plus', () => {
    const meter = { ...newMeter('2026-03-01'), playgroundRequests: 100 };
    expect(checkPlayground(plus(), meter, NOW).allowed).toBe(false);
  });

  it('resets the meter at the day boundary', () => {
    const meter = { day: '2026-03-01', aiTutorQuestions: 3, playgroundRequests: 9 };
    expect(rollMeter(meter, '2026-03-01')).toBe(meter);

    const rolled = rollMeter(meter, '2026-03-02');
    expect(rolled.aiTutorQuestions).toBe(0);
    expect(rolled.day).toBe('2026-03-02');
  });
});

describe('hearts', () => {
  it('spends a heart and schedules the first refill', () => {
    const spent = spendHeart(newHearts(5), NOW);
    expect(spent.current).toBe(4);
    expect(spent.nextRefillAt).toBe(NOW + HEART_REFILL_MS);
  });

  it('never goes below zero', () => {
    let state = newHearts(1);
    state = spendHeart(state, NOW);
    expect(spendHeart(state, NOW).current).toBe(0);
  });

  it('regenerates one heart per interval and stops when full', () => {
    const drained = { current: 2, max: 5, nextRefillAt: NOW };
    expect(regenerateHearts(drained, FREE_ENTITLEMENT, NOW - 1).current).toBe(2);
    expect(regenerateHearts(drained, FREE_ENTITLEMENT, NOW).current).toBe(3);
    expect(regenerateHearts(drained, FREE_ENTITLEMENT, NOW + 2 * HEART_REFILL_MS).current).toBe(5);

    const full = regenerateHearts(drained, FREE_ENTITLEMENT, NOW + 10 * HEART_REFILL_MS);
    expect(full.current).toBe(5);
    expect(full.nextRefillAt).toBeNull();
  });

  it('keeps Plus subscribers permanently full', () => {
    const drained = { current: 0, max: 5, nextRefillAt: NOW + HEART_REFILL_MS };
    const state = regenerateHearts(drained, plus(), NOW);
    expect(state.current).toBe(5);
    expect(state.nextRefillAt).toBeNull();
  });
});

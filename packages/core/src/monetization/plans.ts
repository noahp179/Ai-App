/**
 * Subscription plans and one-off purchases.
 *
 * Pricing lives in code as the source of truth for copy and paywall layout, but
 * the *authoritative* price charged is always the one the store returns at
 * runtime (App Store / Play Store localize and adjust). `priceUsd` here is for
 * display fallback and revenue modelling only — never for charging.
 */

export type PlanId = 'free' | 'plus' | 'pro' | 'teams' | 'edu';
export type BillingPeriod = 'monthly' | 'annual' | 'lifetime' | 'seat-monthly';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Store product identifiers, per period. */
  productIds: Partial<Record<BillingPeriod, string>>;
  priceUsd: Partial<Record<BillingPeriod, number>>;
  /** Days of free trial offered on first subscribe. */
  trialDays: number;
  highlights: string[];
  /** Shown with a "Most popular" ribbon on the paywall. */
  featured?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Synapse Free',
    tagline: 'Learn the fundamentals, forever',
    productIds: {},
    priceUsd: {},
    trialDays: 0,
    highlights: [
      'The full AI Foundations track',
      'First unit of every other track',
      '5 hearts per session',
      'Daily streak and XP',
      '3 AI tutor questions per day',
    ],
  },
  plus: {
    id: 'plus',
    name: 'Synapse Plus',
    tagline: 'The whole curriculum, no limits',
    productIds: {
      monthly: 'app.synapse.plus.monthly',
      annual: 'app.synapse.plus.annual',
    },
    priceUsd: { monthly: 12.99, annual: 89.99 },
    trialDays: 7,
    featured: true,
    highlights: [
      'Every track, every level',
      'Unlimited hearts — never blocked mid-lesson',
      'Unlimited AI tutor with step-by-step explanations',
      'Offline download for the whole catalog',
      'Personalized review scheduling',
      '3 streak freezes and a monthly streak repair',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Synapse Pro',
    tagline: 'For people building AI for a living',
    productIds: {
      monthly: 'app.synapse.pro.monthly',
      annual: 'app.synapse.pro.annual',
    },
    priceUsd: { monthly: 29.99, annual: 249.99 },
    trialDays: 7,
    highlights: [
      'Everything in Plus',
      'Expert project tracks with reviewed capstones',
      'Verified certificates with a public credential page',
      'Interview-prep question bank (500+ questions)',
      'Model playground with higher rate limits',
      'Early access to new tracks',
    ],
  },
  teams: {
    id: 'teams',
    name: 'Synapse for Teams',
    tagline: 'Bring your whole org up to speed',
    productIds: { 'seat-monthly': 'app.synapse.teams.seat.monthly' },
    priceUsd: { 'seat-monthly': 19.0 },
    trialDays: 14,
    highlights: [
      'Everything in Pro for every seat',
      'Admin dashboard with per-team progress',
      'Assigned learning paths and due dates',
      'Custom private tracks for internal tooling',
      'SSO/SAML and SCIM provisioning',
      'Usage and completion reporting for L&D',
    ],
  },
  edu: {
    id: 'edu',
    name: 'Synapse for Education',
    tagline: 'Classroom licences for schools and universities',
    productIds: { 'seat-monthly': 'app.synapse.edu.seat.monthly' },
    priceUsd: { 'seat-monthly': 4.0 },
    trialDays: 30,
    highlights: [
      'Everything in Pro for every student',
      'Instructor console with gradebook export',
      'Cohort management and assignment scheduling',
      'Academic-integrity mode for proctored checkpoints',
      'Free for Title I and low-income institutions',
    ],
  },
};

/** Non-subscription purchases. Consumables plus one durable good. */
export interface ConsumableProduct {
  id: string;
  productId: string;
  name: string;
  description: string;
  priceUsd: number;
  kind: 'gems' | 'hearts' | 'streak-repair' | 'certificate' | 'track';
}

export const CONSUMABLES: ConsumableProduct[] = [
  {
    id: 'gems-small',
    productId: 'app.synapse.gems.500',
    name: '500 Gems',
    description: 'Refill hearts, buy streak freezes, unlock bonus challenges.',
    priceUsd: 4.99,
    kind: 'gems',
  },
  {
    id: 'gems-large',
    productId: 'app.synapse.gems.3000',
    name: '3,000 Gems',
    description: 'Best value — 20% more gems per dollar.',
    priceUsd: 24.99,
    kind: 'gems',
  },
  {
    id: 'heart-refill',
    productId: 'app.synapse.hearts.refill',
    name: 'Heart Refill',
    description: 'Full hearts, right now. Free with Plus.',
    priceUsd: 0.99,
    kind: 'hearts',
  },
  {
    id: 'streak-repair',
    productId: 'app.synapse.streak.repair',
    name: 'Streak Repair',
    description: 'Restore a streak you broke in the last 48 hours.',
    priceUsd: 2.99,
    kind: 'streak-repair',
  },
  {
    id: 'certificate',
    productId: 'app.synapse.certificate',
    name: 'Verified Certificate',
    description: 'A shareable, verifiable credential for one completed track.',
    priceUsd: 39.0,
    kind: 'certificate',
  },
  {
    id: 'track-unlock',
    productId: 'app.synapse.track.unlock',
    name: 'Single Track Unlock',
    description: 'Own one track outright, no subscription.',
    priceUsd: 24.99,
    kind: 'track',
  },
];

/** Annual savings as a whole-number percentage, for the paywall's badge. */
export function annualSavingsPercent(plan: Plan): number | null {
  const monthly = plan.priceUsd.monthly;
  const annual = plan.priceUsd.annual;
  if (monthly === undefined || annual === undefined) return null;
  const fullPrice = monthly * 12;
  return Math.round(((fullPrice - annual) / fullPrice) * 100);
}

/** Per-month equivalent of an annual plan, for "$7.50/mo billed annually". */
export function monthlyEquivalent(plan: Plan): number | null {
  const annual = plan.priceUsd.annual;
  return annual === undefined ? null : Math.round((annual / 12) * 100) / 100;
}

// Wire format between FlowCompanion and a marketplace server (server/ in this repo is the reference
// implementation). Both sides validate with these schemas.
import { z } from 'zod';

export const API_PREFIX = '/api/v1';
export const TRIAL_DAYS = 7;

const iso = z.string().min(10).max(40);
export const ProviderLabels = z.array(z.enum(['any', 'openai', 'anthropic', 'gemini', 'local'])).min(1).max(5);
export const Pricing = z.discriminatedUnion('type', [
  z.object({ type: z.literal('free') }),
  z.object({ type: z.literal('paid'), priceCents: z.number().int().min(99).max(100_000), currency: z.enum(['USD', 'EUR', 'GBP']) }),
]);
export type PricingT = z.infer<typeof Pricing>;
export const SEMVER = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export const ServerInfo = z.object({
  name: z.string().max(100),
  version: z.string().max(40),
  paymentsEnabled: z.boolean(),
  trialDays: z.number().int(),
  registrationOpen: z.boolean(),
  demoContent: z.boolean(),
});
export type ServerInfoT = z.infer<typeof ServerInfo>;

export const Account = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(['user', 'admin']),
  creatorId: z.string(),
});
export type AccountT = z.infer<typeof Account>;

export const RemoteListing = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  preview: z.string(),
  body: z.string().nullable(),
  category: z.string(),
  tags: z.array(z.string()),
  providers: ProviderLabels,
  creator: z.object({ id: z.string(), displayName: z.string() }),
  pricing: Pricing,
  trialEligible: z.boolean(),
  version: z.string(),
  status: z.enum(['draft', 'pending_review', 'published', 'rejected', 'removed']),
  moderationNote: z.string().nullable(),
  demo: z.boolean(),
  createdAt: iso,
  updatedAt: iso,
  publishedAt: iso.nullable(),
  rating: z.object({ average: z.number(), count: z.number().int() }).nullable(),
});
export type RemoteListingT = z.infer<typeof RemoteListing>;

export const RemoteCreator = z.object({ id: z.string(), displayName: z.string(), bio: z.string(), website: z.string(), listingCount: z.number().int() });
export const RemoteReview = z.object({ id: z.string(), listingId: z.string(), authorName: z.string(), rating: z.number().int().min(1).max(5), text: z.string(), verified: z.boolean(), createdAt: iso });
export const RemoteEntitlement = z.object({
  id: z.string(),
  listingId: z.string(),
  kind: z.enum(['free', 'trial', 'purchase']),
  startsAt: iso,
  expiresAt: iso.nullable(),
  revokedAt: iso.nullable(),
});
export type RemoteEntitlementT = z.infer<typeof RemoteEntitlement>;
export const RemoteAnalytics = z.object({ listingId: z.string(), views: z.number().int(), trialStarts: z.number().int(), acquisitions: z.number().int(), reviews: z.number().int(), averageRating: z.number().nullable() });
export const RemoteReport = z.object({
  id: z.string(),
  listingId: z.string(),
  listingTitle: z.string(),
  reason: z.enum(['spam', 'harmful', 'copyright', 'misleading', 'other']),
  details: z.string(),
  status: z.enum(['open', 'reviewed', 'dismissed']),
  createdAt: iso,
});
export const ModerationQueue = z.object({ pending: z.array(RemoteListing), reports: z.array(RemoteReport) });

// ── Request bodies ──
export const RegisterBody = z.object({ email: z.string().email().max(200), password: z.string().min(10).max(200), displayName: z.string().min(1).max(60) });
export const LoginBody = z.object({ email: z.string().max(200), password: z.string().max(200) });
export const ListingDraftBody = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(300),
  preview: z.string().max(600),
  body: z.string().min(20).max(50_000),
  category: z.string().min(1).max(40),
  tags: z.array(z.string().max(40)).max(10),
  providers: ProviderLabels,
  pricing: Pricing,
  trialEligible: z.boolean(),
  version: z.string().regex(SEMVER, 'Use a version like 1.0.0'),
  changelog: z.string().max(2000).default(''),
});
export type ListingDraftBodyT = z.input<typeof ListingDraftBody>;
export const ReviewBody = z.object({ rating: z.number().int().min(1).max(5), text: z.string().max(2000) });
export const ReportBody = z.object({ reason: z.enum(['spam', 'harmful', 'copyright', 'misleading', 'other']), details: z.string().max(2000) });
export const ModerateListingBody = z.object({ action: z.enum(['approve', 'reject', 'remove']), note: z.string().max(1000).default('') });
export const ResolveReportBody = z.object({ action: z.enum(['reviewed', 'dismissed']) });
export const ProfileBody = z.object({ displayName: z.string().min(1).max(60), bio: z.string().max(1000), website: z.string().max(200) });

export const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const trigrams = (w: string[]) => new Set(w.slice(2).map((_, i) => `${w[i]} ${w[i + 1]} ${w[i + 2]}`));

/** The preview must not give away the prompt: flags previews that reproduce half or more of its word sequences. */
export function previewProblem(preview: string, body: string): string | null {
  const pw = words(preview);
  const bw = words(body);
  if (!pw.length || !bw.length) return null;
  const msg = 'The preview reproduces most of the prompt. Describe what it does or show a short excerpt instead.';
  if (bw.length < 5) return pw.join(' ').includes(bw.join(' ')) ? msg : null;
  const bt = trigrams(bw);
  const pt = trigrams(pw);
  let covered = 0;
  for (const t of bt) if (pt.has(t)) covered++;
  return covered / bt.size >= 0.5 ? msg : null;
}

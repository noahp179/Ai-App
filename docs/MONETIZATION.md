# Monetization Strategy

How Synapse makes money, why each mechanism is built the way it is, and what
would have to be true for it to work.

The organising principle: **the free tier has to be genuinely good.** An
education app people abandon in week one earns nothing regardless of its pricing
page. Every mechanism below is designed to convert people who are already
getting value, not to extract from people who are stuck.

---

## 1. Subscriptions — the primary engine

Implemented in `packages/core/src/monetization/plans.ts`.

| Plan | Price | Who it's for |
|---|---|---|
| **Free** | $0 | Everyone. Full Foundations track + first unit of every track, forever |
| **Plus** | $12.99/mo · $89.99/yr | The default paid tier — the whole curriculum, no limits |
| **Pro** | $29.99/mo · $249.99/yr | People building AI professionally — certificates, interview prep |
| **Teams** | $19/seat/mo | Companies upskilling staff — SSO, admin dashboard, assignments |
| **Education** | $4/seat/mo | Schools and universities — gradebook, cohorts, proctored checkpoints |

### Why these numbers

Anchored against what the market has already validated: Duolingo Super is
~$12.99/mo, Brilliant is ~$149/yr, DataCamp ~$25/mo. Plus sits deliberately at
Duolingo's price point — familiar, and low enough that the decision is not
deliberated. Annual is discounted ~42%, which is aggressive on purpose: annual
plans have roughly **3–4× the lifetime value** of monthly because they skip the
month-two churn cliff entirely.

Pro is priced at a professional-tools tier rather than a consumer one. Someone
preparing for an ML engineering interview is comparing it to a $300 course, not
to a $10 app.

### The free/paid line

Free includes:
- The complete **AI Foundations** track (3 units, 6 lessons, checkpoints)
- **Unit 1 of every other track** — a real sample of all eleven subjects
- 5 hearts per session, 3 AI-tutor questions per day, 1 streak freeze
- Full streaks, XP, achievements, and spaced review

This is more generous than most competitors, and that is the strategy rather
than an oversight. Someone who finishes Foundations has learned something real,
has a streak worth protecting, and has hit the first unit of five other tracks
they now want to finish. **The upgrade sells itself at that point.** Someone who
hit a paywall in lesson two never got far enough to want anything.

---

## 2. Consumables — the secondary line

| Product | Price | Notes |
|---|---|---|
| 500 Gems | $4.99 | Refill hearts, buy freezes, unlock bonus challenges |
| 3,000 Gems | $24.99 | 20% better per-gem value |
| Heart Refill | $0.99 | Free with Plus |
| Streak Repair | $2.99 | Restore a streak broken in the last 48h |
| Verified Certificate | $39 | One completed track, publicly verifiable |
| Single Track Unlock | $24.99 | Own one track outright, no subscription |

Typically 10–20% of revenue for an app like this. Two notes on how it is built:

**Streak repair is the highest-intent purchase in the catalog.** Someone who has
just lost a 60-day streak converts at rates nothing else comes close to. It is
also the mechanism most easily abused — which is why it is capped at 48 hours
and Plus includes one free repair a month. Monetizing loss aversion is
legitimate; farming it is not, and it produces refunds and uninstalls.

**Single track unlock exists to catch the anti-subscription buyer.** A
meaningful share of people will never subscribe to anything but will happily buy
a thing. $24.99 for one track is priced above two months of Plus, so it does not
cannibalise subscriptions — it captures revenue that would otherwise be zero.

---

## 3. B2B — where the margin actually is

Consumer subscriptions have thin per-user economics and constant churn.
Teams and Education have neither.

**Synapse for Teams — $19/seat/month.** Every company with engineers is now
under pressure to have an AI literacy story, and almost none have one. A 200-seat
contract is $45,600/year, roughly 350 consumer Plus subscribers, at a fraction of
the support burden and with annual renewals rather than monthly churn.

What has to exist for this to close: SSO/SAML, SCIM provisioning, an admin
dashboard with per-team completion, assignable learning paths with due dates, and
usage reporting L&D can take to their budget holder. Custom private tracks — a
company's own internal AI tooling taught in the same format — is the feature that
makes contracts sticky and near-impossible to switch away from.

**Synapse for Education — $4/seat/month.** Lower price, much higher volume,
extremely long retention. A university that adopts Synapse for an intro AI course
renews for years. It also seeds the consumer funnel: students who used it in
coursework subscribe personally after they graduate.

Free for Title I and low-income institutions. This is the right thing to do and
it is also excellent distribution — those cohorts become the next intake.

---

## 4. Certificates and credentials

$39 per verified certificate, included with Pro.

Credentials are high-margin (the marginal cost is a database row and a public
verification page) and they hit a moment of genuine willingness to pay: someone
who has just completed a 20-lesson expert track wants something to put on
LinkedIn.

The requirement is that the credential is worth something. That means a
proctored final assessment, a public verification URL, and enough rigour that an
employer seeing one has learned something. A certificate mill devalues the whole
product; this only works if the certificate is hard to get.

---

## 5. Advertising — deliberately minimal

Ads appear only on the free tier, only between sessions, and **never inside a
lesson**. Rewarded video is offered as an alternative to paying for a heart
refill.

Expect this to be a small revenue line. It exists for two reasons: it monetizes
free users who will never convert (the large majority), and a rewarded ad is a
genuinely useful third option for someone who wants to keep going but cannot
justify a subscription.

Interrupting a lesson with an ad would damage the core product more than the
revenue is worth. That constraint is enforced in code, not policy —
`limitsFor()` exposes `showsAds`, and no lesson-player surface reads it.

---

## 6. Revenue model

Assumptions grounded in published benchmarks for education apps:

| Metric | Assumption | Basis |
|---|---|---|
| Free → paid conversion | 4% | Duolingo ~8%, typical edtech 2–5% |
| Annual plan share | 55% | Driven by the 42% annual discount |
| Monthly churn (monthly plans) | 8% | Typical for consumer subscription education |
| Monthly churn (annual plans) | 1.5% | Annual plans churn at renewal, not monthly |
| ARPPU (blended) | ~$9.20/mo | Mix of Plus/Pro, monthly/annual, minus store fees |

**At 100,000 monthly active users:**

- 4,000 paying subscribers × ~$9.20 = **~$36,800/month** subscription revenue
- Consumables at ~15% of subscription = ~$5,500/month
- Ads on 96,000 free users at ~$0.04 ARPU = ~$3,800/month
- **~$46,100/month, ~$553,000/year** consumer

Add ten Teams contracts averaging 150 seats: **10 × 150 × $19 × 12 =
$342,000/year**, at materially better margins and retention.

Store fees take 15% (30% above $1M/year, and Apple's Small Business Program
keeps it at 15% below that threshold). Web checkout via Stripe avoids this
entirely for desktop and browser users, at ~3% — which is why the macOS app
routes subscription purchases to web checkout where store policy permits.

---

## 7. What actually determines whether this works

Pricing is the easy part. Three things decide the outcome:

**Day-7 retention.** Below ~25%, no pricing model saves the business. Above ~40%,
most reasonable ones work. Everything in the product — streaks, daily goals,
spaced review, session length — exists to serve this number. It is the metric to
optimise before touching the paywall.

**Time-to-first-value.** The learner has to feel they have learned something real
inside the first session. This is why lesson one is "What Is AI, Really?" with a
genuine, non-obvious idea in it (the AI effect) rather than a tour of the
interface.

**The credibility of the free tier.** Every mechanism above assumes the learner
already trusts that the content is good. That trust is built entirely in the free
tier, and it is why Foundations gets the most careful writing in the catalog
rather than the least.

---

## 8. Instrumentation

The events needed to run this are defined as a typed union in
`packages/core/src/services/analytics.ts`. Two funnels are declared explicitly:

**Activation:** `app_opened` → `onboarding_completed` → `lesson_started` →
`lesson_completed` → `daily_goal_met` → `streak_extended`

**Monetization:** `paywall_shown` → `plan_selected` → `trial_started` →
`purchase_completed`

Every paywall event carries a `PaywallTrigger`, because conversion varies
enormously by surface. Knowing that `hearts-depleted` converts at 3× `settings`
is the difference between tuning the product and guessing at it.

**Privacy constraint, enforced in the analytics module rather than left to
policy:** no event carries free text the learner typed, their email address, or
the content of their answers. Events carry ids and outcomes. A learning app knows
uncomfortably much about how someone thinks, and that is worth being careful
with.

---

## 9. Things deliberately not done

**No dark patterns.** No fake countdown timers, no hidden cancellation, no
pre-checked upsells, no "are you sure you want to abandon your progress" guilt
dialogs. These raise short-term conversion and reliably raise refunds, chargebacks,
and one-star reviews more.

**No punitive heart wall.** Running out of hearts always shows three real
options: wait (with the actual time stated), spend gems, or upgrade. A paywall
pretending to be the only way forward is the thing people uninstall over.

**No selling learner data.** Not to advertisers, not to recruiters, not as
"anonymised training data". The B2B products sell software to institutions, not
information about the people using it.

**No AI-generated curriculum.** Content is written and reviewed by people who
know the material. An AI education app teaching hallucinated facts about AI is
an unrecoverable credibility failure, and the whole business rests on the content
being trustworthy.

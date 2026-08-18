# Synapse

**Learn how AI actually works — from first principles to production systems.**

A complete learning platform for artificial intelligence, machine learning, deep
learning, LLMs, and generative AI. Built for iOS, Android, and macOS from one
TypeScript codebase.

Think Duolingo's pedagogy — short daily sessions, streaks, spaced repetition —
applied to a subject that usually only exists as either a 4-hour YouTube video or
a graduate course.

---

## What's in it

| | |
|---|---|
| **14 tracks** | Foundations · Prompt Engineering · Math · **Types of ML** · ML Mechanics · **Classic Algorithms** · **Data & Features** · Deep Learning · LLMs · Generative AI · Agents · RL · MLOps · Ethics |
| **72 lessons** | 27 units, ~290 minutes of material, all three difficulty levels |
| **353 exercises** | 10 exercise types, every one with a written explanation |
| **141 skills** | Individually tracked with spaced-repetition scheduling |
| **37 interactive widgets** | Across 43 hands-on steps — every track has at least one |

Every track spans intro, intermediate, and expert material. The curriculum is
data (`packages/core/src/content/`), validated on every test run — a typo in a
skill reference fails the build rather than silently breaking review scheduling.

### Machine learning, in depth

Three tracks cover ML specifically, from the taxonomy down to the algorithms:

- **Types of Machine Learning** — the map before the territory. Supervised,
  unsupervised, reinforcement, and self-supervised; then semi-supervised,
  transfer, multi-task, meta-, active, and federated learning; batch vs online;
  instance-based vs model-based; and the recurring problem shapes
  (recommendation, ranking, forecasting, anomaly detection).
- **Classic ML Algorithms** — k-NN, Naive Bayes, SVMs and the kernel trick,
  decision trees, Random Forest, gradient boosting, k-means, DBSCAN,
  hierarchical clustering, PCA, plus model selection and ROC/PR curves.
- **Data & Feature Engineering** — categorical encoding, the three kinds of
  missing data, outliers, feature selection and creation, text features,
  labelling quality, and dataset shift.

---

## Architecture

```
synapse/
├── packages/
│   ├── core/          Domain logic. No React, no native APIs, runs under plain Node.
│   │   ├── domain/       Types: tracks, lessons, exercises, skills
│   │   ├── engine/       Grading, spaced repetition, XP, streaks, placement, sessions
│   │   ├── content/      The curriculum, as validated data
│   │   ├── monetization/ Plans and entitlement rules
│   │   ├── store/        Pure progress-state transitions
│   │   └── services/     AI tutor client, typed analytics
│   └── ui/            Design system: tokens, motion primitives, 12 components
├── apps/
│   ├── mobile/        Expo Router — iOS, Android, and the web build
│   └── desktop/       Electron shell for macOS
└── docs/              Monetization strategy, architecture notes
```

**The rule that shapes everything:** all learning rules live in `@synapse/core`
as pure functions. Grading, scheduling, XP, entitlements, and session state are
testable without mounting a component or booting a simulator — which is why there
are 164 tests that run in under a second.

The apps are rendering layers over that core. `packages/ui` never imports from an
app; apps never reimplement a rule.

---

## Getting started

```bash
npm install
npm test          # 164 tests, ~1s — if this passes, the app will run
npm run web       # open http://localhost:8081
```

Then press <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> in Chrome DevTools
to preview it at iPhone, iPad, and desktop sizes.

| | |
|---|---|
| `npm run web` | Browser — fastest, and how to check phone/tablet layouts |
| `npm run mobile` | QR code for **Expo Go** on your real phone; press `i`/`a` for simulators |
| `npm run desktop` | Electron shell for macOS (needs `npm run web` running too) |
| `npm run desktop:dist` | Build a `.dmg` |

VS Code users: the repo ships tasks, so
<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> starts the web preview and
**Tasks: Run Task** covers the rest.

Requires Node 20+. `cp .env.example .env` before running against a real backend.

**→ [docs/RUNNING.md](docs/RUNNING.md)** has the full walkthrough: simulators,
device previews, the desktop build, and troubleshooting.

---

## How the learning engine works

**Spaced repetition** (`engine/scheduler.ts`) — an SM-2 variant tuned so a lapse
drops the interval to one day rather than resetting all state. Mastery is an
exponential moving average, so one bad answer dents a well-known skill without
erasing it. Recall grade factors in response *time*, because hesitation predicts
forgetting better than correctness alone.

**Adaptive placement** (`engine/placement.ts`) — 12 questions on a difficulty
ladder: step up on a correct answer, down on a wrong one. Places by where the
learner spent the test, weighted for domain coverage. Explainable by design; the
result is always presented as a suggestion the learner can override.

**Session rules** (`engine/session.ts`) — `SessionRunner` is a state machine
handling hearts, mistake re-queuing, and attempt records. Not a React thing, so
every rule is unit-testable in isolation.

**Grading** (`engine/grading.ts`) — ten exercise kinds, all graded locally and
synchronously with partial credit where it makes sense. Free-response answers get
a local keyword rubric as a fallback, so the app teaches fully offline and
without a subscription.

---

## Interactivity

37 widgets, all built from plain views and `PanResponder` — no SVG, no charting
library, no native modules, so they run identically on iOS, Android, and the web
export the macOS app is built from.

**They run the real algorithm, not an animation of one.** k-means genuinely
converges to a local optimum and lands somewhere different from a different
seed. The neural-net trainer does a real forward pass, real backpropagation, and
real gradient descent — set hidden units to zero and it can never learn XOR,
because a model with no nonlinearity is a straight line. Q-learning applies the
actual update rule, so you watch reward propagate backwards from the goal one
episode at a time. A widget that fakes the maths teaches the wrong intuition,
which is worse than teaching none.

A sample of what you can pull on:

- **Sort real scenarios** into the four learning paradigms
- **Fit a line by hand** against live MSE, then add an outlier and watch it tilt
- **Step k-means** one iteration at a time, then reseed and get a different answer
- **Build a decision tree** split by split, watching information gain
- **Train a network** on XOR, circles, or spirals and watch the boundary bend
- **Slide a convolution kernel** across pixels, one output value at a time
- **Trace an ROC curve**, then switch to imbalanced data and watch AUC lie
- **Drag Bayes' prevalence** and watch a 99%-accurate test become usually wrong
- **Route tokens to experts** and collapse the router to see why balancing matters
- **Run an agent loop**, inject a tool failure, and hit the step limit
- **Watch a model drift** while every health dashboard stays green

Every widget ends with a note saying what to notice — the point is never the
widget, it is the thing it makes obvious.

## Design

Dark-first, because the app is used in the evening on a phone. Tokens live in
`packages/ui/src/theme/tokens.ts` — two palettes, a 4pt spacing grid, six type
sizes. Components read tokens and never hardcode a value.

### Motion

Animation here is feedback, not decoration. The moment after an answer is when a
learner finds out whether they understood, and a static state change wastes it.
So: a correct answer pops and bursts, a wrong one shakes briefly, XP counts up,
the accuracy ring fills, steps cross-fade so a new question is unmistakably new,
and content staggers in so a dense explanation arrives in reading order.

Nothing on the critical path exceeds ~350ms — a learner answering thirty
questions must never wait on an animation.

**Reduced motion is honoured throughout.** When the OS setting is on, every
movement collapses to an instant state change — never to nothing, since the
feedback still has to land. Vestibular disorders are common, and an education
app that makes some users nauseous has failed them.

Four widgets play rather than step: k-means runs to convergence with gliding
centroids, the network trains live so you watch the boundary bend, diffusion
denoises frame by frame, and the Q-learning agent floods value backwards from
the goal.

Specific decisions worth naming:

- **The primary button never moves.** Check and Continue occupy the same
  position, so the thumb never hunts mid-session.
- **Explanations show on correct answers too.** Getting it right is the best
  moment to explain why.
- **Answer state is never colour alone.** Every state has a distinct icon.
- **Diagrams are drawn with views, not shipped as images.** They scale, respond
  to the theme, stay readable at accessibility text sizes, and cost nothing.

---

## Monetization

Free tier: the whole Foundations track plus the first unit of every other track,
forever. Paid tiers, consumables, B2B, and the reasoning behind each — including
what was deliberately *not* built — are in **[docs/MONETIZATION.md](docs/MONETIZATION.md)**.

---

## Testing

```bash
npm test
```

164 tests covering the grading engine, scheduler, XP and streak logic, session
state machine, placement algorithm, entitlements, progress transitions, and
catalog integrity.

The catalog tests are load-bearing: they verify that every exercise's stated
answer actually grades as correct, that every skill reference resolves, that no
prerequisite graph has a cycle, that no declared skill goes unpractised, that
every interactive widget is reachable from content, and that every track has at
least one hands-on step. Content is data written by hand, and data written by
hand drifts — two of those checks caught real gaps while this was being built.

---

## Status

Complete and typechecked across all four packages. What a production launch would
still need: real backend services (the tutor gateway, auth, receipt validation),
app icons and splash assets, store listings, and a content review pass by a
second subject-matter expert.

## License

MIT

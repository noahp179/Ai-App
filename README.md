# Synapse

**Learn how computing actually works — from a transistor to a production model.**

A complete learning platform for computer science and artificial intelligence:
programming from zero, the machine underneath it, the systems built on that, and
the AI running on all of it. Built for iOS, Android, and macOS from one
TypeScript codebase.

Think Duolingo's pedagogy — short daily sessions, streaks, spaced repetition —
applied to a subject that usually only exists as either a 4-hour YouTube video or
a graduate course.

---

## What's in it

| | |
|---|---|
| **30 learning paths** | Curated routes through the catalog — pick a goal and the order is decided |
| **40 tracks** | **Programming (3):** Fundamentals · Python · Paradigms<br>**Computer science (12):** DSA · Discrete Maths · Theory of Computation · Compilers · Systems & Performance · Computer Architecture · Operating Systems · Databases · Networking · Software Engineering · Security · Cryptography<br>**Maths & hardware (4):** Math for AI · Information Theory · Statistics & Experimentation · Digital Logic & Hardware<br>**AI & ML (15):** AI Foundations · Prompt Engineering · Types of ML · ML Mechanics · Classic Algorithms · Data & Features · Deep Learning · Computer Vision · NLP · LLMs · Generative AI · Agents · RL · MLOps · Ethics<br>**Applied (6):** The Web · Cloud & Infrastructure · Graphics · Robotics & Embedded · Quantum Computing · Design, Product & Practice |
| **219 lessons** | 106 units, ~875 minutes of material, all three difficulty levels |
| **1,280 exercises** | 11 exercise types, every one with a written explanation |
| **402 skills** | Individually tracked, with a prerequisite graph 6 layers deep |
| **100 interactive widgets** | Every track has at least one hands-on step |
| **146 knowledge tests** | A checkpoint on every unit, an adaptive exam on every track |
| **58 diagrams** | Drawn from views, so they scale and follow the theme |

Every track spans intro, intermediate, and expert material. The curriculum is
data (`packages/core/src/content/`), validated on every test run — a typo in a
skill reference fails the build rather than silently breaking review scheduling,
a duplicate skill id is rejected, and every worked solution to a code exercise is
executed against its own test cases before it can ship.

### Writing code, not just answering about it

One exercise type runs what you type. A prompt, a starter template, and test
cases that actually execute:

- On web the submission runs in a **Worker** with `fetch`, `XHR` and
  `importScripts` removed, terminated after 2 seconds — the only way to
  interrupt a beginner's first infinite loop.
- Cases are **visible or hidden**. Visible ones make the task unambiguous and
  show expected-versus-actual on failure; hidden ones run only once the visible
  ones pass, so special-casing the shown inputs does not count as a solution.
- Float comparison has a relative tolerance, because an exercise asking for an
  average should not fail on `0.1 + 0.2`.

### Paths

Forty tracks is a catalog, not a curriculum. A **path** is an ordered route
through several of them, built around a goal someone actually has:

| | |
|---|---|
| **Follow the Conversation** | Understand what people are talking about. No maths. |
| **Start With the Fundamentals** | The computer science underneath, before any of the AI |
| **Build With LLMs** | Ship a language-model feature that survives real users |
| **Machine Learning Engineer** | Train it, evaluate it honestly, keep it alive in production |
| **Data Science Foundations** | The classical toolkit, before anything deep |
| **Deep Learning, Properly** | From one neuron to the architectures behind modern models |
| **Computer Vision Engineer** | Pixels to production, one pipeline |
| **NLP Engineer** | From bag of words to production language models |
| **Generative AI End to End** | Text, images, and the models that make both |
| **Safety and Alignment** | How these systems are steered, and why that is hard |
| **AI for Decision Makers** | Enough depth to ask the right questions — no calculus |
| **Learning From Consequences** | Reinforcement learning, from gridworlds to RLHF |
| **ML Interview Prep** | The algorithms round and the ML round, plus the maths behind both |
| **Computer Science, Properly** | The degree-shaped route, without the degree |
| **Backend Engineer** | Everything behind the API, from schema to incident |
| **Make It Fast** | Find the real bottleneck, then fix the right layer |
| **Ship It Securely** | The failures that cause most breaches, and the habits that prevent them |
| **CS Interview Prep** | Algorithms, systems design, and the questions behind the questions |
| **AI Infrastructure** | The systems layer under every training run |
| **Learn to Code** | From never having programmed to writing real things |
| **Full-Stack Engineer** | Browser to database, and everything in between |
| **Platform & Reliability** | Run it, watch it, and survive the incident |
| **The Theory Underneath** | Logic, information, computation, and the limits of each |
| **From Sand to Software** | The whole stack, bottom to top |
| **Measure It Properly** | Experiments and evidence that survive scrutiny |
| **Security & Cryptography** | Why the padlock means anything, and where systems fail |
| **Build Things People Can Use** | Design, accessibility, and the professional half of the job |
| **Graphics & Simulation** | Geometry into pixels, and the hardware it created |
| **AI in the Physical World** | Robots, sensors, control, and safety-critical engineering |
| **The Frontier** | Where computing is going, without the press releases |

Paths own no content — they are references into the same tracks — so a lesson
finished anywhere counts toward every path containing it, and a path can never
drift out of sync with the curriculum except by naming a track that no longer
exists, which the catalog validator rejects. Onboarding goals rank them, and
every track appears in at least one path (also a test).

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
  labelling quality, dataset shift, where training data comes from, synthetic
  data and model collapse, class imbalance, and the four kinds of leakage.

### Programming

Three tracks assume nothing, because the rest of the catalog assumed a great
deal. Someone arriving at AI from outside software was expected to already know
what a loop is and what Python idiom looks like.

- **Programming Fundamentals** — variables, branching, loops, functions, scope
  and closures, collections, references and aliasing, text and encoding, and
  failing deliberately. Taught by writing code that executes against test cases
  in the app.
- **Python for AI** — idiom, comprehensions and generators, the data model,
  NumPy broadcasting, DataFrames and split-apply-combine, environments, and the
  four traps (mutable defaults, late binding, `is` vs `==`, shallow copies).
- **Programming Paradigms** — objects and the invariants they protect,
  inheritance versus composition, purity and immutability, static versus
  dynamic typing, generics, and why null is a design flaw.

### Computer science

Twelve tracks here are not about AI at all. They exist because the ML material
kept gesturing at them: complexity analysis the moment anyone asks why a nested
loop over a million rows is a bad idea, the memory hierarchy behind every
"vectorise your loops", floating point behind every `NaN`, and the reason
training runs on GPUs rather than CPUs. People arriving from outside software
need somewhere to learn this that does not assume a degree.

- **Data Structures & Algorithms** — Big-O from first principles, analysing
  loops and recursion, amortised cost, the five structures every language
  ships, binary search and balanced trees, graph traversal from BFS to
  Dijkstra, sorting and its O(n log n) lower bound, and recursion through to
  dynamic programming and greedy algorithms.
- **Systems & Performance** — the memory hierarchy, cache lines and locality,
  stack versus heap, concurrency versus parallelism, race conditions and locks,
  I/O-bound versus CPU-bound, profiling, and Amdahl's law.
- **Computer Architecture** — binary and two's complement, floating point and
  numerical stability, the instruction cycle, compiled versus interpreted
  versus JIT, SIMD, and why GPUs suit deep learning.
- **Operating Systems** — the kernel boundary and what a syscall costs, CPU
  scheduling, virtual memory and page faults, thrashing, files and durability,
  and containers as namespaces plus cgroups.
- **Databases** — the relational model, normalisation, SQL and joins, indexes
  and query plans, ACID and isolation levels, OLTP versus OLAP, and sharding
  versus replication.
- **Networking & Distributed Systems** — the layers a request passes through,
  DNS and TLS, HTTP and API design, latency budgets, caching, load balancing,
  queues, CAP, consistency models, idempotency, and retry with backoff.
- **Software Engineering Practice** — commits and branching, code review, the
  test pyramid, property-based testing, CI/CD, debugging as binary search, and
  technical debt as a decision rather than a moral failing.
- **Security Fundamentals** — threat modelling, authn versus authz, hashing
  versus encryption, password storage, TLS and certificates, injection, XSS and
  CSRF, secrets, and supply-chain risk. Defensive throughout.
- **Theory of Computation** — finite automata, regular and context-free
  languages, Turing machines, undecidability, P versus NP, NP-completeness, and
  what to do when the exact answer is out of reach.
- **Discrete Maths for CS** — propositional logic, proof techniques, induction,
  sets and relations, combinatorics, the pigeonhole principle, graph theory,
  modular arithmetic, and recurrence relations.
- **Compilers & Interpreters** — lexing, parsing and where precedence lives,
  semantic analysis, SSA and why LLVM exists, optimisation passes and the as-if
  rule, register allocation as graph colouring, and garbage collection.
- **Cryptography** — Kerckhoffs, AES and why ECB leaks a picture, randomness as
  a primitive, Diffie–Hellman, signatures versus MACs, and a precise account of
  what quantum computing breaks.

Over half the interactive widgets are theirs — including one that hands the
asymptotically better algorithm a 200× constant penalty and lets you find the
crossover where it still wins, one that lets you interleave two threads by hand
until the counter comes out wrong, one that builds arithmetic from NAND gates,
and one that bisects a thousand commits in ten questions.

### Maths, hardware, and the rest

- **Digital Logic & Hardware** — transistors as switches, gates, boolean
  simplification as literal cost reduction, the half adder that turns out to be
  one XOR and one AND, feedback as memory, and what actually ended in 2005.
- **Information Theory** — why information has to be a logarithm, entropy as
  average surprise, the compression floor it sets, Huffman codes hitting that
  floor exactly, and the line straight to cross-entropy loss and perplexity.
- **Statistics & Experimentation** — sampling error versus bias, confidence
  intervals read correctly, the four things a p-value is not, power and the
  winner's curse, peeking and multiple comparisons, and what randomisation buys
  that adjustment cannot.
- **How the Web Works** — semantic markup, the box model, the DOM, the
  single-threaded event loop, the render pipeline, Core Web Vitals, and
  accessibility as a default rather than an add-on.
- **Cloud & Infrastructure** — shared responsibility, VMs versus containers
  versus functions, orchestration as a reconciliation loop, serverless and cold
  starts, infrastructure as code, observability, cost, and RPO/RTO.
- **Computer Graphics** — raster and vector, gamma, homogeneous coordinates,
  rasterization and the depth buffer, shading, ray tracing and its square-root
  convergence, textures and aliasing.
- **Robotics & Embedded** — bare metal, sensors as noisy estimates, hard real
  time where worst case is the only number that matters, PID, Kalman filtering
  and SLAM, and what changes when a bug can injure someone.
- **Quantum Computing** — written against the "both at once" framing. A qubit
  is an amplitude vector; cancellation, not parallelism, is the speedup. Honest
  numbers on Shor versus Grover, and on how far away the hardware is.
- **Design, Product & Practice** — mental models, affordances, inclusive
  design, Goodhart and guardrail metrics, dark patterns — then writing,
  estimating, incidents, on-call, mentoring and interviewing.

And the two AI tracks that previously had skills but no home:

- **Computer Vision** — images as tensors, convolution from first principles,
  pooling and receptive fields, the architecture lineage from LeNet to ResNet,
  vision transformers, and detection versus segmentation.
- **NLP Before Transformers** — normalisation, TF-IDF, byte-pair encoding,
  Word2Vec, RNNs and LSTMs, and the seq2seq bottleneck that attention removed.
  Worth doing before the LLM track: attention is much easier to appreciate once
  you have felt the problem it solved.

### Finding your way around

- **Search** across tracks, lessons, skills and paths — including concept key
  terms, so searching a definition finds the lesson that defines it.
- **A skill map** built from the prerequisite graph: 402 skills, six layers
  deep, with a *Ready* view listing exactly the skills whose prerequisites you
  have mastered and which you have not.
- **Adaptive track exams** that visit weak skills first, so a fixed-length paper
  spends its questions where you are least certain.

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
are 194 tests that run in under a second.

The apps are rendering layers over that core. `packages/ui` never imports from an
app; apps never reimplement a rule.

---

## Getting started

```bash
npm install
npm test          # 194 tests, ~1s — if this passes, the app will run
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

## Knowledge tests

Three kinds of assessment, answering three different questions.

**Placement** (`engine/placement.ts`) — *where should I start?* Twelve adaptive
questions on a difficulty ladder, taken once, spanning every domain.

**Unit checkpoints** — *did that unit land?* Hand-written, three questions, at
the end of all 53 units. Pass at 70%.

**Track exams** (`engine/assessment.ts`) — *do I know this subject?* Fifteen
questions assembled from the track's own exercises, round-robined across
distinct skills so the paper covers the breadth of the track rather than
drilling one corner. Deterministic per track and seed, so reloading gives you
the same paper rather than an easier one.

Exams are generated rather than authored on purpose. A separate hand-written
exam per track would be another 250 exercises to keep in sync with the lessons,
and it would drift; sampling the track's own questions cannot.

A test is not a lesson, and the differences are deliberate:

- **No hearts.** A wrong answer costs marks, not lives.
- **No re-queuing.** Lessons re-ask a question until you get it right, which is
  good teaching and would make a score meaningless.
- **First answer only.** Retrying within the same sitting does not rescue it.
- **No completion bonus on a fail.** The correct answers still earn their
  points; finishing a test you failed is not an achievement.

What comes back is a **per-skill breakdown**, worst first — the part you can act
on. Every answer also feeds the spaced-repetition scheduler, so a test is never
wasted time even when you fail it, and the skills you got wrong come back
sooner.

Exams double as a way to **test out**: sit one before starting a track and the
breakdown tells you which units are worth your time.

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

**Assessment** (`engine/assessment.ts`) — resolves any checkpoint or track exam
by id, samples exam papers across skills, and grades a sitting into a per-skill
breakdown. Pure functions over the catalog, so every one is unit-tested without
mounting a screen.

**Grading** (`engine/grading.ts`) — ten exercise kinds, all graded locally and
synchronously with partial credit where it makes sense. Free-response answers get
a local keyword rubric as a fallback, so the app teaches fully offline and
without a subscription.

---

## Interactivity

41 widgets, all built from plain views and `PanResponder` — no SVG, no charting
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

- **Race four sorting algorithms** and watch the comparison counter, not the bars
- **Run BFS and DFS on one maze** and see which finds the shorter route
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

**[design/](design/)** holds a seven-artboard design canvas built on those exact
tokens: Today, a graded lesson, the completion screen, the Lab, the network
trainer, the macOS window, and a full design-system sheet. Four of the artboards
are live — you can answer the question, filter the Lab, and train the network in
them — and the sticky notes say which parts are shipped and which are proposals.

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

194 tests covering the grading engine, scheduler, XP and streak logic, session
state machine, placement algorithm, entitlements, progress transitions, path
curation, assessment building and scoring, and catalog integrity.

The catalog tests are load-bearing: they verify that every exercise's stated
answer actually grades as correct, that every skill reference resolves, that no
prerequisite graph has a cycle, that no declared skill goes unpractised, that
every interactive widget is reachable from content, that every track has at
least one hands-on step, that every unit has a checkpoint, and that every track
is reachable from at least one learning path. Content is data written by hand, and data written by hand drifts
— several of those checks caught real gaps while this was being built.

---

## Status

Complete and typechecked across all four packages. What a production launch would
still need: real backend services (the tutor gateway, auth, receipt validation),
app icons and splash assets, store listings, and a content review pass by a
second subject-matter expert.

## License

MIT
